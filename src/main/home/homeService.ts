/**
 * 首页服务 — 今日任务、数据概览、快捷入口
 */

import { PrismaClient } from '@prisma/client';

// ═══════════════════ 类型 ═══════════════════

export interface TodayTask {
  type: 'practice' | 'review' | 'wrongbook' | 'import';
  title: string;
  description: string;
  count: number;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QuickStats {
  totalQuestions: number;
  todayPracticed: number;
  accuracy: number;
  streakDays: number;
  dueForReview: number;
  wrongCount: number;
}

export interface RecentActivity {
  id: string;
  type: 'practice' | 'review' | 'import';
  title: string;
  description: string;
  time: string;
}

export interface HomeData {
  tasks: TodayTask[];
  stats: QuickStats;
  recentActivity: RecentActivity[];
}

// ═══════════════════ 今日任务 ═══════════════════

export async function getTodayTasks(
  prisma: PrismaClient
): Promise<TodayTask[]> {
  const tasks: TodayTask[] = [];
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 读取用户每日目标设置
  const goalSetting = await prisma.userSetting.findUnique({ where: { key: 'dailyGoal' } }).catch(() => null);
  let dailyGoal = 20;
  try {
    if (goalSetting) {
      const v = JSON.parse(goalSetting.value);
      if (typeof v === 'number' && v > 0) dailyGoal = v;
    }
  } catch { /* ignore */ }

  // 1. 待复习错题（未掌握的）
  const dueWrong = await prisma.wrongQuestion.count({
    where: {
      mastered: false,
    },
  });

  if (dueWrong > 0) {
    tasks.push({
      type: 'wrongbook',
      title: '错题复习',
      description: `${dueWrong} 道错题需要复习`,
      count: dueWrong,
      action: '去复习',
      priority: 'high',
    });
  }

  // 2. 今日练习情况
  const todayPracticed = await prisma.studyRecord.count({
    where: {
      studiedAt: { gte: todayStart, lt: todayEnd },
    },
  });

  if (todayPracticed === 0) {
    tasks.push({
      type: 'practice',
      title: '开始今日练习',
      description: `今天还没有练习，今日目标 ${dailyGoal} 题`,
      count: 0,
      action: '开始练习',
      priority: 'high',
    });
  } else if (todayPracticed < dailyGoal) {
    tasks.push({
      type: 'practice',
      title: '继续练习',
      description: `今天已练习 ${todayPracticed}/${dailyGoal} 题，再做几题？`,
      count: todayPracticed,
      action: '继续',
      priority: 'medium',
    });
  }

  // 3. 分项练习建议 — Bug #16 优化：只拉最近 500 条 + 用 include 一次查到 section，避免整表 + N+1
  const recentForSection = await prisma.studyRecord.findMany({
    select: { isCorrect: true, question: { select: { section: true } } },
    orderBy: { studiedAt: 'desc' },
    take: 500,
  });

  const sectionAccuracy = new Map<string, { total: number; correct: number }>();
  for (const r of recentForSection as Array<{ isCorrect: boolean; question: { section: string } | null }>) {
    const section = r.question?.section || 'UNKNOWN';
    const e = sectionAccuracy.get(section) || { total: 0, correct: 0 };
    e.total++;
    if (r.isCorrect) e.correct++;
    sectionAccuracy.set(section, e);
  }

  let weakestSection = '';
  let lowestAccuracy = 1;
  for (const [section, data] of sectionAccuracy) {
    if (data.total >= 3) {
      const accuracy = data.correct / data.total;
      if (accuracy < lowestAccuracy) {
        lowestAccuracy = accuracy;
        weakestSection = section;
      }
    }
  }

  const SECTION_NAMES: Record<string, string> = {
    LISTENING: '听力',
    READING: '阅读',
    WRITING: '写作',
    TRANSLATION: '翻译',
  };

  if (weakestSection && lowestAccuracy < 0.6) {
    tasks.push({
      type: 'practice',
      title: `加强${SECTION_NAMES[weakestSection] || weakestSection}练习`,
      description: `${SECTION_NAMES[weakestSection]}正确率 ${(lowestAccuracy * 100).toFixed(0)}%，需要加强`,
      count: 0,
      action: '专项练习',
      priority: 'medium',
    });
  }

  // 4. 新题导入建议
  const totalQuestions = await prisma.question.count();
  if (totalQuestions < 50) {
    tasks.push({
      type: 'import',
      title: '导入更多题目',
      description: `当前题库共 ${totalQuestions} 题，建议导入更多题目`,
      count: totalQuestions,
      action: '去导入',
      priority: 'low',
    });
  }

  return tasks;
}

// ═══════════════════ 快速统计 ═══════════════════

export async function getQuickStats(
  prisma: PrismaClient
): Promise<QuickStats> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 总题数
  const totalQuestions = await prisma.question.count();

  // 今日练习数
  const todayPracticed = await prisma.studyRecord.count({
    where: {
      studiedAt: { gte: todayStart, lt: todayEnd },
    },
  });

  // 整体正确率
  const totalRecords = await prisma.studyRecord.count();
  const correctRecords = await prisma.studyRecord.count({
    where: { isCorrect: true },
  });

  // 待复习错题（未掌握的）
  const dueForReview = await prisma.wrongQuestion.count({
    where: {
      mastered: false,
    },
  });

  // 错题总数
  const wrongCount = await prisma.wrongQuestion.count();

  // 连续学习天数 — 单次查询所有日期再在内存中算连续
  // 仅取最近 365 天数据即可（避免读全表）
  const oneYearAgo = new Date(todayStart);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const recentDayRecords = await prisma.studyRecord.findMany({
    where: { studiedAt: { gte: oneYearAgo } },
    select: { studiedAt: true },
    orderBy: { studiedAt: 'desc' },
  });
  const daySet = new Set<string>(recentDayRecords.map((r: { studiedAt: Date }) => r.studiedAt.toISOString().split('T')[0]));

  let streakDays = 0;
  const cursor = new Date(todayStart);
  // 若今天没学也允许从昨天往前算
  if (!daySet.has(cursor.toISOString().split('T')[0])) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (daySet.has(cursor.toISOString().split('T')[0])) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    totalQuestions,
    todayPracticed,
    accuracy: totalRecords > 0 ? correctRecords / totalRecords : 0,
    streakDays,
    dueForReview,
    wrongCount,
  };
}

// ═══════════════════ 最近活动 ═══════════════════

export async function getRecentActivity(
  prisma: PrismaClient,
  limit = 10
): Promise<RecentActivity[]> {
  // 获取最近的学习记录
  const records = await prisma.studyRecord.findMany({
    orderBy: { studiedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      isCorrect: true,
      studiedAt: true,
      question: {
        select: {
          questionType: true,
          section: true,
        },
      },
    },
  });

  const SECTION_NAMES: Record<string, string> = {
    LISTENING: '听力',
    READING: '阅读',
    WRITING: '写作',
    TRANSLATION: '翻译',
  };

  const TYPE_NAMES: Record<string, string> = {
    LISTENING_MCQ: '听力选择',
    BANKED_CLOZE: '选词填空',
    CAREFUL_READING: '仔细阅读',
    INFO_MATCHING: '信息匹配',
    ESSAY: '写作',
    TRANSLATION: '翻译',
  };

  return records.map(record => ({
    id: record.id,
    type: 'practice' as const,
    title: `${SECTION_NAMES[record.question.section] || record.question.section} - ${TYPE_NAMES[record.question.questionType] || record.question.questionType}`,
    description: record.isCorrect ? '回答正确' : '回答错误',
    time: record.studiedAt.toISOString(),
  }));
}

// ═══════════════════ 综合首页数据 ═══════════════════

export async function getHomeData(
  prisma: PrismaClient
): Promise<HomeData> {
  const [tasks, stats, recentActivity] = await Promise.all([
    getTodayTasks(prisma),
    getQuickStats(prisma),
    getRecentActivity(prisma),
  ]);

  return {
    tasks,
    stats,
    recentActivity,
  };
}
