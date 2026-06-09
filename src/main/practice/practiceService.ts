/**
 * 练习服务 — 会话管理、评分、统计
 *
 * 流程：创建会话（抽题）→ 逐题提交评分 → 完成会话（写入 StudyRecord）
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { addWrongQuestion } from '../review/wrongBookService';

// ═══════════════════ 类型 ═══════════════════

export interface PracticeSessionData {
  sessionId: string;
  questionIds: string[];
  currentIndex: number;
  startTime: number;
  results: PracticeResultData[];
  completed: boolean;
}

export interface PracticeResultData {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string | string[];
  timeSpentMs: number;
}

export interface StartConfig {
  mode: 'quick' | 'focused' | 'mock' | 'wrongbook';
  section?: string;
  questionType?: string;
  difficulty?: number;
  count?: number;
}

export interface SubmitAnswer {
  questionId: string;
  answer: string | string[];
  timeSpentMs: number;
}

export interface SessionSummary {
  sessionId: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimeMs: number;
  results: PracticeResultData[];
}

// 内存中的活跃会话（简单实现，生产可用 Redis/DB）
const activeSessions = new Map<string, PracticeSessionData>();

// ═══════════════════ 创建会话 ═══════════════════

export async function startSession(
  prisma: PrismaClient,
  config: StartConfig
): Promise<PracticeSessionData> {
  const count = config.count || 10;

  // 构建查询条件
  const where: Record<string, unknown> = {};
  if (config.section) where.section = config.section;
  if (config.questionType) where.questionType = config.questionType;
  if (config.difficulty) where.difficulty = config.difficulty;

  // 随机抽题
  const questions = await prisma.question.findMany({
    where,
    select: { id: true },
    take: count * 2, // 多取一些用于随机
  });

  // 随机打乱并取 count 道
  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);

  if (shuffled.length === 0) {
    throw new Error('没有找到符合条件的题目，请调整筛选条件');
  }

  const session: PracticeSessionData = {
    sessionId: randomUUID(),
    questionIds: shuffled.map(q => q.id),
    currentIndex: 0,
    startTime: Date.now(),
    results: [],
    completed: false,
  };

  activeSessions.set(session.sessionId, session);
  return session;
}

// ═══════════════════ 获取当前题目 ═══════════════════

export async function getCurrentQuestion(
  prisma: PrismaClient,
  sessionId: string
) {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('会话不存在或已过期');

  const questionId = session.questionIds[session.currentIndex];
  if (!questionId) return null;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      questionType: true,
      section: true,
      subSection: true,
      difficulty: true,
      content: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      knowledgePoints: true,
    },
  });

  return {
    question,
    index: session.currentIndex,
    total: session.questionIds.length,
    results: session.results,
  };
}

// ═══════════════════ 提交答案 ═══════════════════

export async function submitAnswer(
  prisma: PrismaClient,
  sessionId: string,
  answer: SubmitAnswer
): Promise<PracticeResultData> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('会话不存在或已过期');

  const question = await prisma.question.findUnique({
    where: { id: answer.questionId },
    select: { correctAnswer: true, questionType: true },
  });

  if (!question) throw new Error('题目不存在');

  // 评分
  const isCorrect = gradeAnswer(
    question.questionType,
    question.correctAnswer,
    answer.answer
  );

  const result: PracticeResultData = {
    questionId: answer.questionId,
    isCorrect,
    correctAnswer: question.correctAnswer,
    userAnswer: answer.answer,
    timeSpentMs: answer.timeSpentMs,
  };

  session.results.push(result);
  session.currentIndex++;

  return result;
}

// ═══════════════════ 完成会话 ═══════════════════

export async function completeSession(
  prisma: PrismaClient,
  sessionId: string
): Promise<SessionSummary> {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error('会话不存在或已过期');

  session.completed = true;

  const correctCount = session.results.filter(r => r.isCorrect).length;
  const totalTimeMs = session.results.reduce((sum, r) => sum + r.timeSpentMs, 0);

  // 写入 StudyRecord
  for (const result of session.results) {
    await prisma.studyRecord.create({
      data: {
        questionId: result.questionId,
        rating: result.isCorrect ? 3 : 1, // Good / Again
        responseTimeMs: result.timeSpentMs,
        isCorrect: result.isCorrect,
      },
    });
  }

  // 更新错题本
  const wrongResults = session.results.filter(r => !r.isCorrect);
  for (const wrong of wrongResults) {
    await addWrongQuestion(prisma, wrong.questionId);
  }

  const summary: SessionSummary = {
    sessionId,
    totalQuestions: session.results.length,
    correctCount,
    accuracy: session.results.length > 0 ? correctCount / session.results.length : 0,
    totalTimeMs,
    avgTimeMs: session.results.length > 0 ? totalTimeMs / session.results.length : 0,
    results: session.results,
  };

  // 清理会话
  activeSessions.delete(sessionId);

  return summary;
}

// ═══════════════════ 评分逻辑 ═══════════════════

function gradeAnswer(
  questionType: string,
  correctAnswer: string,
  userAnswer: string | string[]
): boolean {
  const normalized = (s: string) => s.trim().toLowerCase();

  switch (questionType) {
    case 'LISTENING_MCQ':
    case 'CAREFUL_READING':
      // 选择题：精确匹配选项字母
      return normalized(String(userAnswer)) === normalized(correctAnswer);

    case 'BANKED_CLOZE': {
      // 选词填空：JSON 格式 {"1":"word","2":"word"}，逐个比对
      try {
        const userMap = typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
        const correctMap = JSON.parse(correctAnswer);
        return Object.keys(correctMap).every(
          key => normalized(userMap[key] || '') === normalized(correctMap[key])
        );
      } catch {
        return false;
      }
    }

    case 'INFO_MATCHING': {
      // 信息匹配：JSON 格式 {"36":"A","37":"B"}，逐个比对
      try {
        const userMap = typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
        const correctMap = JSON.parse(correctAnswer);
        return Object.keys(correctMap).every(
          key => normalized(userMap[key] || '') === normalized(correctMap[key])
        );
      } catch {
        return false;
      }
    }

    case 'TRANSLATION':
    case 'ESSAY':
      // 主观题：不自动评分，返回 false，由用户自评
      return false;

    default:
      return false;
  }
}
