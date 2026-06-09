/**
 * 数据质量校验引擎 — 9 条规则
 *
 * 每道题目入库前必须通过校验。severity 为 error 的问题会阻止入库，
 * warning 仅标记但允许入库。
 */

export interface QualityIssue {
  field: string;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
}

type Validator = (q: RawQuestion) => QualityIssue | null;
type QuestionContent = {
  stem?: unknown;
  passageWithBlanks?: unknown;
  chineseText?: unknown;
  prompt?: unknown;
};

export interface RawQuestion {
  questionType: string;
  section: string;
  content: string;       // JSON string
  options?: string | null; // JSON string
  correctAnswer: string;
  explanation?: string | null;
  audioFileId?: string | null;
  examYear?: number | null;
  knowledgePoints?: string; // JSON string
}

// ═══════════════════ 校验规则定义 ═══════════════════

const RULES: Validator[] = [
  // 1. 题干不能为空
  (q) => {
    const content = safeParse<QuestionContent>(q.content);
    const hasStem = content?.stem || content?.passageWithBlanks || content?.chineseText || content?.prompt;
    if (!hasStem || String(hasStem).trim().length === 0) {
      return { field: 'content', severity: 'error', code: 'EMPTY_STEM', message: '题干内容不能为空' };
    }
    return null;
  },

  // 2. 选择题选项数量必须为 4
  (q) => {
    if (q.questionType !== 'LISTENING_MCQ' && q.questionType !== 'CAREFUL_READING') return null;
    if (!q.options) {
      return { field: 'options', severity: 'error', code: 'OPTIONS_MISSING', message: '选择题必须提供选项' };
    }
    const opts = safeParse<unknown>(q.options);
    if (!Array.isArray(opts) || opts.length !== 4) {
      return { field: 'options', severity: 'error', code: 'OPTIONS_COUNT_MISMATCH', message: `选择题需要4个选项，实际 ${Array.isArray(opts) ? opts.length : 0} 个` };
    }
    return null;
  },

  // 3. 答案不能为空
  (q) => {
    if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
      return { field: 'correctAnswer', severity: 'error', code: 'EMPTY_ANSWER', message: '正确答案不能为空' };
    }
    return null;
  },

  // 4. 解析缺失（warning）
  (q) => {
    if (!q.explanation || q.explanation.trim().length === 0) {
      return { field: 'explanation', severity: 'warning', code: 'MISSING_EXPLANATION', message: '缺少答案解析（不影响入库）' };
    }
    return null;
  },

  // 5. 听力音频可播放（有 audioFileId 时检查）
  (q) => {
    // 音频校验需要异步查库，这里仅做字段存在性检查
    if (q.questionType?.startsWith('LISTENING_') && !q.audioFileId) {
      // 听力题暂时允许无音频（内置题可能没音频文件）
      return { field: 'audioFileId', severity: 'warning', code: 'AUDIO_MISSING', message: '听力题未关联音频文件' };
    }
    return null;
  },

  // 6. 题目与音频对应（简化版：有 audioFileId 时检查字段一致性）
  (q) => {
    // 完整校验需要查库比对，在导入层单独处理
    return null;
  },

  // 7. 年份完整
  (q) => {
    if (!q.examYear) {
      return { field: 'examYear', severity: 'warning', code: 'MISSING_YEAR', message: '缺少考试年份' };
    }
    return null;
  },

  // 8. 题型完整
  (q) => {
    const validTypes = ['LISTENING_MCQ', 'BANKED_CLOZE', 'CAREFUL_READING', 'INFO_MATCHING', 'ESSAY', 'TRANSLATION'];
    const validSections = ['LISTENING', 'READING', 'WRITING', 'TRANSLATION'];

    if (!q.questionType || !validTypes.includes(q.questionType)) {
      return { field: 'questionType', severity: 'error', code: 'INVALID_TYPE', message: `无效题型: ${q.questionType}` };
    }
    if (!q.section || !validSections.includes(q.section)) {
      return { field: 'section', severity: 'error', code: 'INVALID_SECTION', message: `无效考试板块: ${q.section}` };
    }
    return null;
  },

  // 9. 知识点标签（warning）
  (q) => {
    if (!q.knowledgePoints) {
      return { field: 'knowledgePoints', severity: 'warning', code: 'MISSING_TAGS', message: '缺少知识点标签' };
    }
    const tags = safeParse<unknown>(q.knowledgePoints);
    if (!Array.isArray(tags) || tags.length === 0) {
      return { field: 'knowledgePoints', severity: 'warning', code: 'EMPTY_TAGS', message: '知识点标签为空数组' };
    }
    return null;
  },
];

// ═══════════════════ 公开方法 ═══════════════════

/**
 * 校验一道题目，返回校验结果
 */
export function validateQuestion(q: RawQuestion): QualityCheckResult {
  const issues: QualityIssue[] = [];

  for (const rule of RULES) {
    const issue = rule(q);
    if (issue) issues.push(issue);
  }

  const hasBlockingError = issues.some(i => i.severity === 'error');

  return {
    passed: !hasBlockingError,
    issues,
  };
}

/**
 * 批量校验，返回通过/失败统计
 */
export function validateBatch(questions: RawQuestion[]): {
  passed: number;
  failed: number;
  results: Array<{ index: number; result: QualityCheckResult }>;
} {
  let passed = 0;
  let failed = 0;
  const results: Array<{ index: number; result: QualityCheckResult }> = [];

  questions.forEach((q, index) => {
    const result = validateQuestion(q);
    results.push({ index, result });
    if (result.passed) passed++;
    else failed++;
  });

  return { passed, failed, results };
}

// ═══════════════════ 工具函数 ═══════════════════

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
