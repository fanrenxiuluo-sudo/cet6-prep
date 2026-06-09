/**
 * 错题本服务 — 错题管理、FSRS调度、批量操作
 */

import { PrismaClient } from '@prisma/client';
import { createCard, reviewCard, type Card, type Rating } from '../practice/fsrsService';

// ═══════════════════ 类型 ═══════════════════

export interface WrongQuestionWithCard {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  mastered: boolean;
  notes: string | null;
  // FSRS 字段
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  state: string;
  due: string;
  question: {
    questionType: string;
    section: string;
    difficulty: number;
    content: string;
    options: string | null;
    correctAnswer: string;
    explanation: string | null;
    knowledgePoints: string;
  };
}

export interface ReviewResult {
  card: Card;
  previousStability: number;
  newStability: number;
  previousDifficulty: number;
  newDifficulty: number;
  nextReview: Date;
}

export interface ReviewStats {
  totalWrong: number;
  mastered: number;
  dueForReview: number;
  averageStability: number;
  averageDifficulty: number;
  bySection: Array<{
    section: string;
    count: number;
    mastered: number;
    dueForReview: number;
  }>;
}

// ═══════════════════ FSRS 转换 ═══════════════════

/**
 * 将数据库记录转换为 FSRS Card
 */
function toCard(wrong: any): Card {
  return {
    id: wrong.questionId,
    stability: wrong.stability || 0.4,
    difficulty: wrong.difficulty || 5,
    elapsedDays: wrong.elapsedDays || 0,
    scheduledDays: wrong.scheduledDays || 0,
    reps: wrong.reps || 0,
    state: (wrong.state as Card['state']) || 'New',
    due: wrong.due ? new Date(wrong.due) : new Date(),
  };
}

/**
 * 将 FSRS Card 转换为数据库更新字段
 */
function toUpdateFields(card: Card) {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    reps: card.reps,
    state: card.state,
    due: card.due,
  };
}

// ═══════════════════ 核心功能 ═══════════════════

/**
 * 添加错题（首次）
 */
export async function addWrongQuestion(
  prisma: PrismaClient,
  questionId: string
): Promise<void> {
  const existing = await prisma.wrongQuestion.findFirst({
    where: { questionId },
  });

  if (existing) {
    // 已存在，增加错误次数
    await prisma.wrongQuestion.update({
      where: { id: existing.id },
      data: {
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: new Date(),
      },
    });
  } else {
    // 创建新卡片，使用 FSRS 初始化
    const card = createCard(questionId, 1); // Again rating

    await prisma.wrongQuestion.create({
      data: {
        questionId,
        wrongCount: 1,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        state: 'New',
        due: card.due,
      },
    });
  }
}

/**
 * 复习错题（应用 FSRS 算法）
 */
export async function reviewWrongQuestion(
  prisma: PrismaClient,
  wrongQuestionId: string,
  rating: Rating
): Promise<ReviewResult> {
  const wrong = await prisma.wrongQuestion.findUnique({
    where: { id: wrongQuestionId },
  });

  if (!wrong) {
    throw new Error('错题记录不存在');
  }

  const previousCard = toCard(wrong);

  // 应用 FSRS 算法
  const newCard = reviewCard(previousCard, rating);

  // 更新数据库
  await prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: {
      ...toUpdateFields(newCard),
      lastWrongAt: new Date(),
      mastered: newCard.state === 'Review' && newCard.reps >= 3, // 3次复习后标记掌握
    },
  });

  return {
    card: newCard,
    previousStability: previousCard.stability,
    newStability: newCard.stability,
    previousDifficulty: previousCard.difficulty,
    newDifficulty: newCard.difficulty,
    nextReview: newCard.due,
  };
}

/**
 * 获取今日待复习错题
 */
export async function getDueForReview(
  prisma: PrismaClient,
  limit = 20
): Promise<WrongQuestionWithCard[]> {
  const now = new Date();

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: {
      mastered: false,
      due: { lte: now },
    },
    orderBy: [
      { due: 'asc' }, // 最早到期的优先
      { stability: 'asc' }, // 稳定性低的优先
    ],
    take: limit,
    include: {
      question: {
        select: {
          questionType: true,
          section: true,
          difficulty: true,
          content: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          knowledgePoints: true,
        },
      },
    },
  });

  return wrongQuestions.map(wq => ({
    id: wq.id,
    questionId: wq.questionId,
    wrongCount: wq.wrongCount,
    lastWrongAt: wq.lastWrongAt.toISOString(),
    mastered: wq.mastered,
    notes: wq.notes,
    stability: wq.stability || 0,
    difficulty: wq.difficulty || 5,
    elapsedDays: wq.elapsedDays || 0,
    scheduledDays: wq.scheduledDays || 0,
    reps: wq.reps || 0,
    state: wq.state || 'New',
    due: (wq.due || new Date()).toISOString(),
    question: wq.question,
  }));
}

/**
 * 批量复习（简化版，用于快速复习）
 */
export async function batchReview(
  prisma: PrismaClient,
  reviews: Array<{ wrongQuestionId: string; rating: Rating }>
): Promise<ReviewResult[]> {
  const results: ReviewResult[] = [];

  for (const review of reviews) {
    const result = await reviewWrongQuestion(
      prisma,
      review.wrongQuestionId,
      review.rating
    );
    results.push(result);
  }

  return results;
}

/**
 * 获取错题本统计
 */
export async function getWrongBookStats(
  prisma: PrismaClient
): Promise<ReviewStats> {
  const now = new Date();

  const allWrong = await prisma.wrongQuestion.findMany({
    select: {
      mastered: true,
      due: true,
      stability: true,
      difficulty: true,
      question: {
        select: { section: true },
      },
    },
  });

  const totalWrong = allWrong.length;
  const mastered = allWrong.filter(w => w.mastered).length;
  const dueForReview = allWrong.filter(w => !w.mastered && w.due <= now).length;

  // 按 section 统计
  const sectionMap = new Map<string, { count: number; mastered: number; dueForReview: number; stabilitySum: number; difficultySum: number }>();
  for (const w of allWrong) {
    const section = w.question.section;
    const existing = sectionMap.get(section) || { count: 0, mastered: 0, dueForReview: 0, stabilitySum: 0, difficultySum: 0 };
    existing.count++;
    if (w.mastered) existing.mastered++;
    if (!w.mastered && w.due <= now) existing.dueForReview++;
    existing.stabilitySum += w.stability || 0;
    existing.difficultySum += w.difficulty || 0;
    sectionMap.set(section, existing);
  }

  const bySection = Array.from(sectionMap.entries()).map(([section, data]) => ({
    section,
    count: data.count,
    mastered: data.mastered,
    dueForReview: data.dueForReview,
  }));

  return {
    totalWrong,
    mastered,
    dueForReview,
    averageStability: totalWrong > 0 ? allWrong.reduce((sum, w) => sum + (w.stability || 0), 0) / totalWrong : 0,
    averageDifficulty: totalWrong > 0 ? allWrong.reduce((sum, w) => sum + (w.difficulty || 0), 0) / totalWrong : 0,
    bySection,
  };
}

/**
 * 添加错题笔记
 */
export async function addNote(
  prisma: PrismaClient,
  wrongQuestionId: string,
  notes: string
): Promise<void> {
  await prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: { notes },
  });
}

/**
 * 标记为已掌握
 */
export async function markMastered(
  prisma: PrismaClient,
  wrongQuestionId: string
): Promise<void> {
  await prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: { mastered: true },
  });
}

/**
 * 批量标记已掌握
 */
export async function batchMarkMastered(
  prisma: PrismaClient,
  wrongQuestionIds: string[]
): Promise<void> {
  await prisma.wrongQuestion.updateMany({
    where: { id: { in: wrongQuestionIds } },
    data: { mastered: true },
  });
}

/**
 * 删除错题
 */
export async function removeWrongQuestion(
  prisma: PrismaClient,
  wrongQuestionId: string
): Promise<void> {
  await prisma.wrongQuestion.delete({
    where: { id: wrongQuestionId },
  });
}

/**
 * 批量删除
 */
export async function batchRemove(
  prisma: PrismaClient,
  wrongQuestionIds: string[]
): Promise<void> {
  await prisma.wrongQuestion.deleteMany({
    where: { id: { in: wrongQuestionIds } },
  });
}
