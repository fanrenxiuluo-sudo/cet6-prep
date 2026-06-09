/**
 * 统计服务 — 学习数据分析、ECharts 数据格式
 */

import { PrismaClient } from '@prisma/client';
import log from 'electron-log';

// ═══════════════════ 类型 ═══════════════════

export interface TrendData {
  date: string;
  count: number;
  accuracy: number;
  avgTime: number;
}

export interface SectionAccuracy {
  section: string;
  accuracy: number;
  total: number;
  correct: number;
}

export interface DifficultyDistribution {
  difficulty: number;
  count: number;
  accuracy: number;
}

export interface TimeDistribution {
  range: string;
  count: number;
  accuracy: number;
}

export interface MasteryProgress {
  date: string;
  mastered: number;
  total: number;
  masteryRate: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayStudied: number;
  todayAccuracy: number;
}

export interface LearningHeatmap {
  date: string;
  count: number;
}

export interface WrongTrend {
  date: string;
  newWrong: number;
  mastered: number;
  total: number;
}

export interface ComprehensiveStats {
  overview: {
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number;
    avgTimeMs: number;
    totalDays: number;
    studyDays: number;
  };
  streak: StreakData;
  trend: TrendData[];
  sectionAccuracy: SectionAccuracy[];
  difficultyDistribution: DifficultyDistribution[];
  timeDistribution: TimeDistribution[];
  masteryProgress: MasteryProgress[];
  heatmap: LearningHeatmap[];
  wrongTrend: WrongTrend[];
}

// ═══════════════════ 趋势数据 ═══════════════════

export async function getTrendData(
  prisma: PrismaClient,
  days = 30
): Promise<TrendData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.studyRecord.findMany({
    where: { studiedAt: { gte: startDate } },
    orderBy: { studiedAt: 'asc' },
    select: {
      isCorrect: true,
      responseTimeMs: true,
      studiedAt: true,
    },
  });

  // 按日期聚合
  const dailyMap = new Map<string, { count: number; correct: number; totalTime: number }>();
  for (const record of records) {
    const date = record.studiedAt.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { count: 0, correct: 0, totalTime: 0 };
    existing.count++;
    if (record.isCorrect) existing.correct++;
    existing.totalTime += record.responseTimeMs;
    dailyMap.set(date, existing);
  }

  // 生成完整日期序列（包括没有数据的日期）
  const result: TrendData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr) || { count: 0, correct: 0, totalTime: 0 };

    result.push({
      date: dateStr,
      count: dayData.count,
      accuracy: dayData.count > 0 ? dayData.correct / dayData.count : 0,
      avgTime: dayData.count > 0 ? dayData.totalTime / dayData.count / 1000 : 0, // 秒
    });
  }

  return result;
}

// ═══════════════════ 分项正确率 ═══════════════════

export async function getSectionAccuracy(
  prisma: PrismaClient
): Promise<SectionAccuracy[]> {
  const records = await prisma.studyRecord.findMany({
    select: {
      isCorrect: true,
      question: { select: { section: true } },
    },
  });

  const sectionMap = new Map<string, { correct: number; total: number }>();
  for (const record of records) {
    const section = record.question.section;
    const existing = sectionMap.get(section) || { correct: 0, total: 0 };
    existing.total++;
    if (record.isCorrect) existing.correct++;
    sectionMap.set(section, existing);
  }

  return Array.from(sectionMap.entries()).map(([section, data]) => ({
    section,
    accuracy: data.total > 0 ? data.correct / data.total : 0,
    total: data.total,
    correct: data.correct,
  }));
}

// ═══════════════════ 难度分布 ═══════════════════

export async function getDifficultyDistribution(
  prisma: PrismaClient
): Promise<DifficultyDistribution[]> {
  const records = await prisma.studyRecord.findMany({
    select: {
      isCorrect: true,
      question: { select: { difficulty: true } },
    },
  });

  const diffMap = new Map<number, { count: number; correct: number }>();
  for (const record of records) {
    const difficulty = record.question.difficulty;
    const existing = diffMap.get(difficulty) || { count: 0, correct: 0 };
    existing.count++;
    if (record.isCorrect) existing.correct++;
    diffMap.set(difficulty, existing);
  }

  return Array.from(diffMap.entries()).map(([difficulty, data]) => ({
    difficulty,
    count: data.count,
    accuracy: data.count > 0 ? data.correct / data.count : 0,
  })).sort((a, b) => a.difficulty - b.difficulty);
}

// ═══════════════════ 时间分布 ═══════════════════

export async function getTimeDistribution(
  prisma: PrismaClient
): Promise<TimeDistribution[]> {
  const records = await prisma.studyRecord.findMany({
    select: {
      isCorrect: true,
      responseTimeMs: true,
    },
  });

  const ranges = [
    { min: 0, max: 5000, label: '0-5秒' },
    { min: 5000, max: 10000, label: '5-10秒' },
    { min: 10000, max: 20000, label: '10-20秒' },
    { min: 20000, max: 30000, label: '20-30秒' },
    { min: 30000, max: Infinity, label: '30秒以上' },
  ];

  const distribution = ranges.map(range => ({
    range: range.label,
    count: 0,
    correct: 0,
  }));

  for (const record of records) {
    const timeMs = record.responseTimeMs;
    const idx = ranges.findIndex(r => timeMs >= r.min && timeMs < r.max);
    if (idx >= 0) {
      distribution[idx].count++;
      if (record.isCorrect) distribution[idx].correct++;
    }
  }

  return distribution.map(d => ({
    range: d.range,
    count: d.count,
    accuracy: d.count > 0 ? d.correct / d.count : 0,
  }));
}

// ═══════════════════ 掌握进度 ═══════════════════

export async function getMasteryProgress(
  prisma: PrismaClient,
  days = 30
): Promise<MasteryProgress[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    select: {
      mastered: true,
      lastWrongAt: true,
    },
  });

  // 按日期聚合掌握情况
  const dailyMap = new Map<string, { mastered: number; total: number }>();
  for (const wq of wrongQuestions) {
    const date = wq.lastWrongAt.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { mastered: 0, total: 0 };
    existing.total++;
    if (wq.mastered) existing.mastered++;
    dailyMap.set(date, existing);
  }

  // 生成日期序列
  const result: MasteryProgress[] = [];
  let cumulativeMastered = 0;
  let cumulativeTotal = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr) || { mastered: 0, total: 0 };

    cumulativeMastered += dayData.mastered;
    cumulativeTotal += dayData.total;

    result.push({
      date: dateStr,
      mastered: cumulativeMastered,
      total: cumulativeTotal,
      masteryRate: cumulativeTotal > 0 ? cumulativeMastered / cumulativeTotal : 0,
    });
  }

  return result;
}

// ═══════════════════ 学习热力图 ═══════════════════

export async function getLearningHeatmap(
  prisma: PrismaClient,
  days = 365
): Promise<LearningHeatmap[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.studyRecord.findMany({
    where: { studiedAt: { gte: startDate } },
    select: { studiedAt: true },
  });

  const dailyMap = new Map<string, number>();
  for (const record of records) {
    const date = record.studiedAt.toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  }

  const result: LearningHeatmap[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    result.push({
      date: dateStr,
      count: dailyMap.get(dateStr) || 0,
    });
  }

  return result;
}

// ═══════════════════ 错题趋势 ═══════════════════

export async function getWrongTrend(
  prisma: PrismaClient,
  days = 30
): Promise<WrongTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: { lastWrongAt: { gte: startDate } },
    orderBy: { lastWrongAt: 'asc' },
    select: {
      mastered: true,
      lastWrongAt: true,
    },
  });

  // 按日期聚合
  const dailyMap = new Map<string, { newWrong: number; mastered: number }>();
  for (const wq of wrongQuestions) {
    const date = wq.lastWrongAt.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { newWrong: 0, mastered: 0 };
    existing.newWrong++;
    if (wq.mastered) existing.mastered++;
    dailyMap.set(date, existing);
  }

  // 生成日期序列
  const result: WrongTrend[] = [];
  let totalWrong = 0;
  let totalMastered = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr) || { newWrong: 0, mastered: 0 };

    totalWrong += dayData.newWrong;
    totalMastered += dayData.mastered;

    result.push({
      date: dateStr,
      newWrong: dayData.newWrong,
      mastered: dayData.mastered,
      total: totalWrong - totalMastered,
    });
  }

  return result;
}

// ═══════════════════ 连续学习天数 ═══════════════════

export async function getStreakData(
  prisma: PrismaClient
): Promise<StreakData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今日数据
  const todayStart = new Date(today);
  const todayEnd = new Date(today);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayRecords = await prisma.studyRecord.findMany({
    where: {
      studiedAt: { gte: todayStart, lt: todayEnd },
    },
    select: { isCorrect: true },
  });

  const todayStudied = todayRecords.length;
  const todayCorrect = todayRecords.filter(r => r.isCorrect).length;

  // 计算连续天数（从今天往前数）
  let currentStreak = 0;
  const checkDate = new Date(today);

  for (;;) {
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayRecords = await prisma.studyRecord.count({
      where: {
        studiedAt: { gte: dayStart, lt: dayEnd },
      },
    });

    if (dayRecords > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // 计算最长连续天数（简化版：找连续有记录的最长序列）
  const allRecords = await prisma.studyRecord.findMany({
    orderBy: { studiedAt: 'asc' },
    select: { studiedAt: true },
  });

  const uniqueDays = new Set(allRecords.map(r => r.studiedAt.toISOString().split('T')[0]));
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = '';

  for (const day of Array.from(uniqueDays).sort()) {
    if (prevDate) {
      const prev = new Date(prevDate);
      const curr = new Date(day);
      const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = day;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    todayStudied,
    todayAccuracy: todayStudied > 0 ? todayCorrect / todayStudied : 0,
  };
}

// ═══════════════════ 综合统计 ═══════════════════

export async function getComprehensiveStats(
  prisma: PrismaClient
): Promise<ComprehensiveStats> {
  const totalQuestions = await prisma.studyRecord.count();
  const totalCorrect = await prisma.studyRecord.count({ where: { isCorrect: true } });

  const avgTimeResult = await prisma.studyRecord.aggregate({
    _avg: { responseTimeMs: true },
  });

  // 统计学习天数
  const allRecords = await prisma.studyRecord.findMany({
    select: { studiedAt: true },
  });
  const uniqueDays = new Set(allRecords.map(r => r.studiedAt.toISOString().split('T')[0]));

  const [streak, trend, sectionAccuracy, difficultyDistribution, timeDistribution, masteryProgress, heatmap, wrongTrend] =
    await Promise.all([
      getStreakData(prisma),
      getTrendData(prisma, 30),
      getSectionAccuracy(prisma),
      getDifficultyDistribution(prisma),
      getTimeDistribution(prisma),
      getMasteryProgress(prisma, 30),
      getLearningHeatmap(prisma, 365),
      getWrongTrend(prisma, 30),
    ]);

  return {
    overview: {
      totalQuestions,
      totalCorrect,
      accuracy: totalQuestions > 0 ? totalCorrect / totalQuestions : 0,
      avgTimeMs: avgTimeResult._avg.responseTimeMs || 0,
      totalDays: uniqueDays.size,
      studyDays: uniqueDays.size,
    },
    streak,
    trend,
    sectionAccuracy,
    difficultyDistribution,
    timeDistribution,
    masteryProgress,
    heatmap,
    wrongTrend,
  };
}
