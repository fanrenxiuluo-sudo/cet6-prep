/**
 * Gamification 服务 — 成就系统、经验值、等级
 *
 * 成就类型：
 * - 练习类：完成练习次数、连续练习
 * - 正确率类：单次正确率、总体正确率
 * - 错题类：错题掌握数量
 * - 连续类：连续学习天数
 * - 特殊类：首次练习、导入题目等
 */

import { PrismaClient } from '@prisma/client';
import log from 'electron-log';

// ═══════════════════ 类型 ═══════════════════

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'practice' | 'accuracy' | 'wrongbook' | 'streak' | 'special';
  condition: string;
  reward: number; // 经验值奖励
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface UserProfile {
  level: number;
  experience: number;
  nextLevelExp: number;
  totalPoints: number;
  streakDays: number;
  achievements: Achievement[];
  recentAchievements: Achievement[];
}

export interface LevelConfig {
  level: number;
  requiredExp: number;
  title: string;
}

// ═══════════════════ 等级配置 ═══════════════════

export const LEVEL_CONFIG: LevelConfig[] = [
  { level: 1, requiredExp: 0, title: '初学者' },
  { level: 2, requiredExp: 100, title: '入门者' },
  { level: 3, requiredExp: 300, title: '学习者' },
  { level: 4, requiredExp: 600, title: '进阶者' },
  { level: 5, requiredExp: 1000, title: '熟练者' },
  { level: 6, requiredExp: 1500, title: '精通者' },
  { level: 7, requiredExp: 2200, title: '专家' },
  { level: 8, requiredExp: 3000, title: '大师' },
  { level: 9, requiredExp: 4000, title: '宗师' },
  { level: 10, requiredExp: 5000, title: '传奇' },
];

// ═══════════════════ 成就定义 ═══════════════════

export const ACHIEVEMENTS: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress'>[] = [
  // 练习类
  {
    id: 'first_practice',
    name: '初次练习',
    description: '完成第一次练习',
    icon: '🎯',
    category: 'practice',
    condition: 'total_practice >= 1',
    reward: 10,
    target: 1,
  },
  {
    id: 'practice_10',
    name: '初出茅庐',
    description: '完成10次练习',
    icon: '📚',
    category: 'practice',
    condition: 'total_practice >= 10',
    reward: 20,
    target: 10,
  },
  {
    id: 'practice_50',
    name: '勤学苦练',
    description: '完成50次练习',
    icon: '💪',
    category: 'practice',
    condition: 'total_practice >= 50',
    reward: 50,
    target: 50,
  },
  {
    id: 'practice_100',
    name: '百炼成钢',
    description: '完成100次练习',
    icon: '🏆',
    category: 'practice',
    condition: 'total_practice >= 100',
    reward: 100,
    target: 100,
  },

  // 正确率类
  {
    id: 'perfect_session',
    name: '完美发挥',
    description: '单次练习全部答对',
    icon: '⭐',
    category: 'accuracy',
    condition: 'perfect_session >= 1',
    reward: 30,
    target: 1,
  },
  {
    id: 'accuracy_80',
    name: '准确无误',
    description: '总体正确率达到80%',
    icon: '🎯',
    category: 'accuracy',
    condition: 'overall_accuracy >= 0.8',
    reward: 50,
    target: 1,
  },
  {
    id: 'accuracy_90',
    name: '炉火纯青',
    description: '总体正确率达到90%',
    icon: '🌟',
    category: 'accuracy',
    condition: 'overall_accuracy >= 0.9',
    reward: 100,
    target: 1,
  },

  // 错题类
  {
    id: 'master_10',
    name: '错题克星',
    description: '掌握10道错题',
    icon: '📖',
    category: 'wrongbook',
    condition: 'mastered_wrong >= 10',
    reward: 30,
    target: 10,
  },
  {
    id: 'master_50',
    name: '错题终结者',
    description: '掌握50道错题',
    icon: '👑',
    category: 'wrongbook',
    condition: 'mastered_wrong >= 50',
    reward: 100,
    target: 50,
  },

  // 连续类
  {
    id: 'streak_3',
    name: '持之以恒',
    description: '连续学习3天',
    icon: '🔥',
    category: 'streak',
    condition: 'streak_days >= 3',
    reward: 20,
    target: 3,
  },
  {
    id: 'streak_7',
    name: '一周坚持',
    description: '连续学习7天',
    icon: '🔥',
    category: 'streak',
    condition: 'streak_days >= 7',
    reward: 50,
    target: 7,
  },
  {
    id: 'streak_30',
    name: '月度坚持',
    description: '连续学习30天',
    icon: '🔥',
    category: 'streak',
    condition: 'streak_days >= 30',
    reward: 200,
    target: 30,
  },

  // 特殊类
  {
    id: 'import_first',
    name: '知识收集者',
    description: '首次导入题目',
    icon: '📥',
    category: 'special',
    condition: 'import_count >= 1',
    reward: 10,
    target: 1,
  },
  {
    id: 'all_sections',
    name: '全面发展',
    description: '练习过所有题型',
    icon: '🌈',
    category: 'special',
    condition: 'sections_practiced >= 4',
    reward: 30,
    target: 4,
  },
];

// ═══════════════════ 计算等级 ═══════════════════

export function calculateLevel(experience: number): { level: number; title: string; nextLevelExp: number } {
  let currentLevel = LEVEL_CONFIG[0];

  for (const config of LEVEL_CONFIG) {
    if (experience >= config.requiredExp) {
      currentLevel = config;
    } else {
      break;
    }
  }

  const nextLevel = LEVEL_CONFIG.find(l => l.level === currentLevel.level + 1);
  const nextLevelExp = nextLevel ? nextLevel.requiredExp : currentLevel.requiredExp + 1000;

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    nextLevelExp,
  };
}

// ═══════════════════ 获取用户档案 ═══════════════════

export async function getUserProfile(
  prisma: PrismaClient
): Promise<UserProfile> {
  // 获取用户统计
  const stats = await prisma.userStats.findFirst();
  const experience = stats?.growthValue || 0;
  const totalPoints = stats?.totalPoints || 0;
  const streakDays = stats?.streakDays || 0;

  // 计算等级
  const { level, title, nextLevelExp } = calculateLevel(experience);

  // 统计数据
  const totalPractice = await prisma.studyRecord.count();
  const correctCount = await prisma.studyRecord.count({ where: { isCorrect: true } });
  const overallAccuracy = totalPractice > 0 ? correctCount / totalPractice : 0;
  const masteredWrong = await prisma.wrongQuestion.count({ where: { mastered: true } });

  // 统计练习过的题型
  const practicedSections = await prisma.studyRecord.groupBy({
    by: ['questionId'],
  });
  const sectionIds = practicedSections.map(s => s.questionId);
  const sections = await prisma.question.findMany({
    where: { id: { in: sectionIds } },
    select: { section: true },
  });
  const uniqueSections = new Set(sections.map(s => s.section)).size;

  // 计算成就
  const achievements: Achievement[] = ACHIEVEMENTS.map(ach => {
    let progress = 0;
    let unlocked = false;

    switch (ach.id) {
      case 'first_practice':
      case 'practice_10':
      case 'practice_50':
      case 'practice_100':
        progress = totalPractice;
        unlocked = totalPractice >= ach.target;
        break;
      case 'perfect_session':
        progress = 0; // TODO: 需要统计完美场次
        unlocked = false;
        break;
      case 'accuracy_80':
      case 'accuracy_90':
        progress = overallAccuracy >= (ach.target === 1 ? 0.8 : 0.9) ? 1 : 0;
        unlocked = overallAccuracy >= (ach.target === 1 ? 0.8 : 0.9);
        break;
      case 'master_10':
      case 'master_50':
        progress = masteredWrong;
        unlocked = masteredWrong >= ach.target;
        break;
      case 'streak_3':
      case 'streak_7':
      case 'streak_30':
        progress = streakDays;
        unlocked = streakDays >= ach.target;
        break;
      case 'import_first':
        progress = 1; // TODO: 需要统计导入次数
        unlocked = true;
        break;
      case 'all_sections':
        progress = uniqueSections;
        unlocked = uniqueSections >= 4;
        break;
      default:
        progress = 0;
        unlocked = false;
    }

    return {
      ...ach,
      unlocked,
      unlockedAt: unlocked ? new Date().toISOString() : undefined,
      progress: Math.min(progress, ach.target),
    };
  });

  const recentAchievements = achievements
    .filter(a => a.unlocked)
    .slice(0, 5);

  return {
    level,
    experience,
    nextLevelExp,
    totalPoints,
    streakDays,
    achievements,
    recentAchievements,
  };
}

// ═══════════════════ 增加经验值 ═══════════════════

export async function addExperience(
  prisma: PrismaClient,
  amount: number,
  reason: string
): Promise<{ newTotal: number; levelUp: boolean; newLevel?: number }> {
  // 获取或创建用户统计
  let stats = await prisma.userStats.findFirst();
  if (!stats) {
    stats = await prisma.userStats.create({
      data: {
        totalPoints: 0,
        growthValue: 0,
        level: 1,
        streakDays: 0,
      },
    });
  }

  const oldLevel = calculateLevel(stats.growthValue).level;
  const newTotal = stats.growthValue + amount;

  // 更新经验值
  await prisma.userStats.update({
    where: { id: stats.id },
    data: { growthValue: newTotal },
  });

  const { level: newLevel } = calculateLevel(newTotal);
  const levelUp = newLevel > oldLevel;

  log.info(`[Gamification] +${amount} EXP (${reason}), Total: ${newTotal}, Level: ${newLevel}`);

  return {
    newTotal,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
  };
}

// ═══════════════════ 获取排行榜 ═══════════════════

export async function getLeaderboard(
  prisma: PrismaClient
): Promise<Array<{
  rank: number;
  level: number;
  title: string;
  experience: number;
  streak: number;
}>> {
  // 简化版：只有单用户，返回自己
  const stats = await prisma.userStats.findFirst();
  const experience = stats?.growthValue || 0;
  const streakDays = stats?.streakDays || 0;
  const { level, title } = calculateLevel(experience);

  return [
    {
      rank: 1,
      level,
      title,
      experience,
      streak: streakDays,
    },
  ];
}
