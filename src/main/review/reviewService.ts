/**
 * 复盘服务 — 练习记录查询、错题分析、学习统计
 */

import { PrismaClient } from '@prisma/client';
import log from 'electron-log';

// ═══════════════════ 类型 ═══════════════════

export interface SessionHistoryItem {
  date: string; // YYYY-MM-DD
  records: StudyRecordItem[];
  totalCount: number;
  correctCount: number;
  accuracy: number;
}

export interface StudyRecordItem {
  id: string;
  questionId: string;
  rating: number;
  responseTimeMs: number;
  isCorrect: boolean;
  studiedAt: string;
  question: {
    questionType: string;
    section: string;
    content: string;
    correctAnswer: string;
    explanation: string | null;
  };
}

export interface WrongQuestionItem {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  mastered: boolean;
  notes: string | null;
  question: {
    questionType: string;
    section: string;
    difficulty: number;
    content: string;
    options: string | null;
    correctAnswer: string;
    explanation: string | null;
  };
}

export interface OverviewStats {
  totalSessions: number;
  totalQuestions: number;
  overallAccuracy: number;
  avgTimeMs: number;
  currentStreak: number;
  longestStreak: number;
  sectionStats: SectionStat[];
  recentTrend: DailyTrend[];
}

export interface SectionStat {
  section: string;
  totalCount: number;
  correctCount: number;
  accuracy: number;
  avgTimeMs: number;
}

export interface DailyTrend {
  date: string;
  count: number;
  accuracy: number;
}

export interface SessionDetail {
  sessionId: string;
  date: string;
  totalTimeMs: number;
  records: StudyRecordItem[];
}

// ═══════════════════ 获取学习记录（按日期分组）═══════════════════

export async function getStudyHistory(
  prisma: PrismaClient,
  options?: { limit?: number; offset?: number }
): Promise<SessionHistoryItem[]> {
  const limit = options?.limit || 30;
  const offset = options?.offset || 0;

  const records = await prisma.studyRecord.findMany({
    orderBy: { studiedAt: 'desc' },
    take: limit * 20, // 每天可能有多条，多取一些
    skip: offset,
    include: {
      question: {
        select: {
          questionType: true,
          section: true,
          content: true,
          correctAnswer: true,
          explanation: true,
        },
      },
    },
  });

  // 按日期分组
  const grouped = new Map<string, typeof records>();
  for (const record of records) {
    const date = record.studiedAt.toISOString().split('T')[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(record);
  }

  // 转换为 SessionHistoryItem
  const result: SessionHistoryItem[] = [];
  Array.from(grouped.entries()).forEach(([date, dayRecords]) => {
    const totalCount = dayRecords.length;
    const correctCount = dayRecords.filter(r => r.isCorrect).length;

    result.push({
      date,
      records: dayRecords.map(r => ({
        id: r.id,
        questionId: r.questionId,
        rating: r.rating,
        responseTimeMs: r.responseTimeMs,
        isCorrect: r.isCorrect,
        studiedAt: r.studiedAt.toISOString(),
        question: r.question,
      })),
      totalCount,
      correctCount,
      accuracy: totalCount > 0 ? correctCount / totalCount : 0,
    });
  });

  return result.slice(0, limit);
}

// ═══════════════════ 获取错题列表 ═══════════════════

export async function getWrongQuestions(
  prisma: PrismaClient,
  options?: {
    section?: string;
    mastered?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<WrongQuestionItem[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const where: Record<string, unknown> = {};
  if (options?.section) {
    where.question = { section: options.section };
  }
  if (options?.mastered !== undefined) {
    where.mastered = options.mastered;
  }

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where,
    orderBy: { lastWrongAt: 'desc' },
    take: limit,
    skip: offset,
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
    question: wq.question,
  }));
}

// ═══════════════════ 获取整体统计 ═══════════════════

export async function getOverviewStats(
  prisma: PrismaClient
): Promise<OverviewStats> {
  // 总记录数
  const totalRecords = await prisma.studyRecord.count();
  const correctRecords = await prisma.studyRecord.count({
    where: { isCorrect: true },
  });

  // 平均答题时间
  const avgTimeResult = await prisma.studyRecord.aggregate({
    _avg: { responseTimeMs: true },
  });

  // 按题型统计
  const sectionStats = await prisma.studyRecord.groupBy({
    by: ['questionId'],
    _count: true,
    _avg: { responseTimeMs: true },
  });

  // 获取每个 questionId 对应的 section
  const questionIds = sectionStats.map(s => s.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, section: true },
  });

  const sectionMap = new Map(questions.map(q => [q.id, q.section]));

  // 按 section 聚合
  const sectionAgg = new Map<string, { total: number; correct: number; time: number }>();
  for (const stat of sectionStats) {
    const section = sectionMap.get(stat.questionId) || 'UNKNOWN';
    const existing = sectionAgg.get(section) || { total: 0, correct: 0, time: 0 };
    existing.total += stat._count;
    existing.time += stat._avg.responseTimeMs || 0;
    sectionAgg.set(section, existing);
  }

  // 获取每个 section 的正确数
  const correctBySection = await prisma.studyRecord.groupBy({
    by: ['questionId'],
    where: { isCorrect: true },
    _count: true,
  });

  const correctSectionMap = new Map<string, number>();
  for (const stat of correctBySection) {
    const section = sectionMap.get(stat.questionId) || 'UNKNOWN';
    correctSectionMap.set(section, (correctSectionMap.get(section) || 0) + stat._count);
  }

  // 最近7天趋势
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentRecords = await prisma.studyRecord.findMany({
    where: { studiedAt: { gte: sevenDaysAgo } },
    orderBy: { studiedAt: 'asc' },
    select: {
      isCorrect: true,
      studiedAt: true,
    },
  });

  // 按日期聚合
  const dailyMap = new Map<string, { count: number; correct: number }>();
  for (const record of recentRecords) {
    const date = record.studiedAt.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { count: 0, correct: 0 };
    existing.count++;
    if (record.isCorrect) existing.correct++;
    dailyMap.set(date, existing);
  }

  const recentTrend: DailyTrend[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr) || { count: 0, correct: 0 };
    recentTrend.push({
      date: dateStr,
      count: dayData.count,
      accuracy: dayData.count > 0 ? dayData.correct / dayData.count : 0,
    });
  }

  // === Bug #8 修复：计算真实的连续学习/最长连续天数 ===
  const todayStart0 = new Date();
  todayStart0.setHours(0, 0, 0, 0);
  const oneYearAgo = new Date(todayStart0);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const dayRecords = await prisma.studyRecord.findMany({
    where: { studiedAt: { gte: oneYearAgo } },
    select: { studiedAt: true },
    orderBy: { studiedAt: 'asc' },
  });
  const dayKeys: string[] = Array.from(new Set(dayRecords.map((r: { studiedAt: Date }) => r.studiedAt.toISOString().split('T')[0]))).sort();
  // 当前连续
  let currentStreak = 0;
  const cursor = new Date(todayStart0);
  if (!dayKeys.includes(cursor.toISOString().split('T')[0])) {
    cursor.setDate(cursor.getDate() - 1);
  }
  const daySet = new Set<string>(dayKeys);
  while (daySet.has(cursor.toISOString().split('T')[0])) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  // 最长连续
  let longestStreak = 0;
  let temp = 0;
  let prevDay = '';
  for (const day of dayKeys) {
    if (prevDay) {
      const diffDays = (new Date(day).getTime() - new Date(prevDay).getTime()) / 86400000;
      if (diffDays === 1) temp++;
      else { longestStreak = Math.max(longestStreak, temp); temp = 1; }
    } else {
      temp = 1;
    }
    prevDay = day;
  }
  longestStreak = Math.max(longestStreak, temp);

  return {
    totalSessions: dayKeys.length, // 用学习天数作为练习会话数（无 Session 表的合理估算）
    totalQuestions: totalRecords,
    overallAccuracy: totalRecords > 0 ? correctRecords / totalRecords : 0,
    avgTimeMs: avgTimeResult._avg.responseTimeMs || 0,
    currentStreak,
    longestStreak,
    sectionStats: Array.from(sectionAgg.entries()).map(([section, data]) => ({
      section,
      totalCount: data.total,
      correctCount: correctSectionMap.get(section) || 0,
      accuracy: data.total > 0 ? (correctSectionMap.get(section) || 0) / data.total : 0,
      avgTimeMs: data.total > 0 ? data.time / data.total : 0,
    })),
    recentTrend,
  };
}

// ═══════════════════ 获取某次练习详情 ═══════════════════

export async function getSessionDetail(
  prisma: PrismaClient,
  sessionId: string
): Promise<SessionDetail | null> {
  // 根据 sessionId 查找相关记录（简单实现：查找相近时间的记录）
  // 生产环境应该有 Session 表来存储会话信息
  const records = await prisma.studyRecord.findMany({
    where: {
      // 简单实现：查找最近1小时内的记录
      studiedAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
    orderBy: { studiedAt: 'asc' },
    include: {
      question: {
        select: {
          questionType: true,
          section: true,
          content: true,
          correctAnswer: true,
          explanation: true,
        },
      },
    },
  });

  if (records.length === 0) return null;

  const totalTimeMs = records.reduce((sum, r) => sum + r.responseTimeMs, 0);
  const date = records[0].studiedAt.toISOString().split('T')[0];

  return {
    sessionId,
    date,
    totalTimeMs,
    records: records.map(r => ({
      id: r.id,
      questionId: r.questionId,
      rating: r.rating,
      responseTimeMs: r.responseTimeMs,
      isCorrect: r.isCorrect,
      studiedAt: r.studiedAt.toISOString(),
      question: r.question,
    })),
  };
}

// ═══════════════════ 标记错题为已掌握 ═══════════════════

export async function markAsMastered(
  prisma: PrismaClient,
  wrongQuestionId: string
): Promise<void> {
  await prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: { mastered: true },
  });
}

// ═══════════════════ 添加错题笔记 ═══════════════════

export async function addWrongQuestionNote(
  prisma: PrismaClient,
  wrongQuestionId: string,
  notes: string
): Promise<void> {
  await prisma.wrongQuestion.update({
    where: { id: wrongQuestionId },
    data: { notes },
  });
}
