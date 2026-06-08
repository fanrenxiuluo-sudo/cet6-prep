import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface SeedQuestion {
  questionType: string;
  section: string;
  subSection?: string;
  difficulty: number;
  knowledgePoints: string[];
  content: Record<string, unknown>;
  options?: Array<{ label: string; text: string }> | null;
  correctAnswer: string;
  explanation?: string;
  sourceExam?: string;
  examYear?: number;
  examSession?: string;
}

interface SeedFile {
  version: number;
  examLabel: string;
  questions: SeedQuestion[];
}

/**
 * 种子数据导入：将内置 JSON 题包写入数据库
 * 幂等：通过 sourceExam + contentHash 去重，重复执行不会产生重复记录
 */
export async function seedDatabase(prisma: PrismaClient): Promise<{ imported: number; skipped: number }> {
  const seedFiles = [
    'resources/builtin-exams/2024-06-sample.json',
  ];

  let imported = 0;
  let skipped = 0;

  for (const relativePath of seedFiles) {
    const filePath = path.resolve(relativePath);
    let rawData: string;
    try {
      rawData = readFileSync(filePath, 'utf-8');
    } catch {
      console.warn(`[seed] 文件不存在，跳过: ${filePath}`);
      continue;
    }

    const seedData: SeedFile = JSON.parse(rawData);

    for (const q of seedData.questions) {
      const contentJson = JSON.stringify(q.content);
      const optionsJson = q.options ? JSON.stringify(q.options) : null;
      const knowledgeJson = JSON.stringify(q.knowledgePoints);

      // 简单 contentHash：基于题干+选项+答案
      const contentHash = await computeHash(
        q.content.stem || q.content.chineseText || q.content.passageWithBlanks || '' +
        (optionsJson || '') +
        q.correctAnswer
      );

      // 幂等检查：同一 sourceExam + contentHash 不重复插入
      const existing = await prisma.question.findFirst({
        where: {
          sourceExam: q.sourceExam || null,
          contentHash,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.question.create({
        data: {
          questionType: q.questionType,
          section: q.section,
          subSection: q.subSection || null,
          difficulty: q.difficulty,
          knowledgePoints: knowledgeJson,
          content: contentJson,
          options: optionsJson,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
          sourceExam: q.sourceExam || null,
          examYear: q.examYear || null,
          examSession: q.examSession || null,
          contentHash,
          dataSource: 'builtin',
          sourceParser: 'builtinPackParser',
          qualityStatus: 'validated',
        },
      });
      imported++;
    }
  }

  console.log(`[seed] 导入完成: ${imported} 道新题, ${skipped} 道跳过（已存在）`);
  return { imported, skipped };
}

/** 使用 Node.js crypto 计算 SHA-256 */
async function computeHash(input: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}
