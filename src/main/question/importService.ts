/**
 * 题目导入服务 — JSON 批量导入 + 去重 + 质量校验
 *
 * 流程：读取 JSON → 逐条校验质量 → 去重检查 → 入库
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { validateQuestion, type RawQuestion } from '../db/qualityChecker';
import { computeContentHash, computeSimHash, checkDuplicate } from './dedupService';

// ═══════════════════ 类型 ═══════════════════

export interface ImportResult {
  imported: number;
  skipped: number;   // 去重跳过
  rejected: number;  // 质量校验不通过
  errors: ImportError[];
}

export interface ImportError {
  index: number;
  code: string;
  message: string;
}

interface ImportQuestion {
  questionType: string;
  section: string;
  subSection?: string;
  difficulty?: number;
  knowledgePoints?: string[];
  content: Record<string, unknown>;
  options?: Array<{ label: string; text: string }> | null;
  correctAnswer: string;
  explanation?: string;
  sourceExam?: string;
  examYear?: number;
  examSession?: string;
  dataSource?: string;
  sourceParser?: string;
}

// ═══════════════════ 公开方法 ═══════════════════

/**
 * 从 JSON 文件导入题目
 */
export async function importFromJsonFile(
  prisma: PrismaClient,
  filePath: string
): Promise<ImportResult> {
  let rawData: string;
  try {
    rawData = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: [{ index: -1, code: 'FILE_READ_ERROR', message: String(err) }],
    };
  }

  let parsed: { questions?: ImportQuestion[] };
  try {
    parsed = JSON.parse(rawData);
  } catch (err) {
    return {
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: [{ index: -1, code: 'JSON_PARSE_ERROR', message: String(err) }],
    };
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return {
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: [{ index: -1, code: 'INVALID_FORMAT', message: 'JSON 缺少 questions 数组' }],
    };
  }

  return importQuestions(prisma, parsed.questions);
}

/**
 * 从 JSON 字符串导入题目
 */
export async function importFromJsonString(
  prisma: PrismaClient,
  jsonString: string
): Promise<ImportResult> {
  let parsed: { questions?: ImportQuestion[] };
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: [{ index: -1, code: 'JSON_PARSE_ERROR', message: String(err) }],
    };
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return {
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: [{ index: -1, code: 'INVALID_FORMAT', message: 'JSON 缺少 questions 数组' }],
    };
  }

  return importQuestions(prisma, parsed.questions);
}

// ═══════════════════ 核心导入逻辑 ═══════════════════

async function importQuestions(
  prisma: PrismaClient,
  questions: ImportQuestion[]
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  let rejected = 0;
  const errors: ImportError[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // 1. 转为 RawQuestion 进行质量校验
    const raw: RawQuestion = {
      questionType: q.questionType,
      section: q.section,
      content: JSON.stringify(q.content),
      options: q.options ? JSON.stringify(q.options) : null,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      audioFileId: null,
      examYear: q.examYear || null,
      knowledgePoints: JSON.stringify(q.knowledgePoints || []),
    };

    const checkResult = validateQuestion(raw);
    if (!checkResult.passed) {
      rejected++;
      const blockingIssues = checkResult.issues.filter(i => i.severity === 'error');
      errors.push({
        index: i,
        code: blockingIssues[0]?.code || 'UNKNOWN',
        message: blockingIssues.map(i => i.message).join('; '),
      });
      continue;
    }

    // 2. 计算去重指纹
    const contentHash = computeContentHash({
      examYear: q.examYear,
      examSession: q.examSession,
      questionType: q.questionType,
      stem: String(q.content.stem || q.content.chineseText || q.content.passageWithBlanks || q.content.prompt || ''),
      options: q.options ? JSON.stringify(q.options) : undefined,
      correctAnswer: q.correctAnswer,
    });

    const stemSimHash = computeSimHash(
      String(q.content.stem || q.content.chineseText || q.content.passageWithBlanks || q.content.prompt || '')
    );

    // 3. 数据库去重检查
    const dedup = await checkDuplicate(prisma, { contentHash, stemSimHash });
    if (dedup.isDuplicate) {
      skipped++;
      continue;
    }

    // 4. 入库
    try {
      await prisma.question.create({
        data: {
          questionType: q.questionType,
          section: q.section,
          subSection: q.subSection || null,
          difficulty: q.difficulty || 3,
          knowledgePoints: raw.knowledgePoints,
          content: raw.content,
          options: raw.options,
          correctAnswer: q.correctAnswer,
          explanation: raw.explanation,
          sourceExam: q.sourceExam || null,
          examYear: q.examYear || null,
          examSession: q.examSession || null,
          contentHash,
          textSimilarity: JSON.stringify({
            stemFingerprint: stemSimHash,
            cosineThreshold: 0.92,
          }),
          dataSource: q.dataSource || 'import',
          sourceParser: q.sourceParser || 'jsonImport',
          qualityStatus: checkResult.issues.some(i => i.severity === 'warning') ? 'pending' : 'validated',
        },
      });
      imported++;
    } catch (err) {
      errors.push({ index: i, code: 'DB_ERROR', message: String(err) });
    }
  }

  console.log(`[import] 完成: ${imported} 入库, ${skipped} 去重跳过, ${rejected} 校验拒绝, ${errors.length} 错误`);

  return { imported, skipped, rejected, errors };
}
