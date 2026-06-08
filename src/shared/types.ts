// CET6备考助手 - 共享类型定义

// ═══════════════════ 题目相关 ═══════════════════

export type QuestionType =
  | 'LISTENING_MCQ'
  | 'BANKED_CLOZE'
  | 'CAREFUL_READING'
  | 'INFO_MATCHING'
  | 'ESSAY'
  | 'TRANSLATION';

export type Section = 'LISTENING' | 'READING' | 'WRITING' | 'TRANSLATION';

export type SubSection =
  | 'NEWS_REPORT'
  | 'LONG_CONVERSATION'
  | 'LECTURE'
  | 'PASSAGE';

export interface QuestionContent {
  // 通用字段
  stem?: string;           // 题干
  passage?: string;        // 阅读材料/听力原文

  // 选择题
  questionText?: string;   // 问题文本

  // 选词填空
  passageWithBlanks?: string;
  wordBank?: string[];
  blanks?: number[];

  // 写作
  prompt?: string;
  minWords?: number;
  maxWords?: number;

  // 翻译
  chineseText?: string;
  keyPhrases?: string[];
}

export interface QuestionOption {
  label: string;   // A, B, C, D
  text: string;
}

export interface PracticeAnswer {
  questionId: string;
  answer: string | string[];
  timeSpentMs: number;
}

export interface PracticeResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  userAnswer: string | string[];
  timeSpentMs: number;
}

// ═══════════════════ 练习相关 ═══════════════════

export type PracticeMode = 'quick' | 'focused' | 'mock' | 'wrongbook';

export interface PracticeSession {
  id: string;
  mode: PracticeMode;
  questionIds: string[];
  currentIndex: number;
  results: PracticeResult[];
  startTime: number;
  totalTimeMs: number;
  completed: boolean;
}

export interface PracticeConfig {
  mode: PracticeMode;
  section?: Section;
  questionType?: QuestionType;
  difficulty?: number;
  count?: number;
  timeLimitMs?: number;
}

// ═══════════════════ 复盘相关 ═══════════════════

export interface ReviewAnalysis {
  sessionId: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  weakPoints: string[];
  strongPoints: string[];
  timeAnalysis: {
    averageMs: number;
    longestMs: number;
    shortestMs: number;
  };
}

// ═══════════════════ 学习计划 ═══════════════════

export type LearningPhase = 'beginner' | 'intermediate' | 'advanced';

export interface StudyTask {
  type: 'practice' | 'review' | 'mock' | 'vocab';
  questionIds: string[];
  completed: boolean;
  section?: Section;
  questionType?: QuestionType;
}

// ═══════════════════ 统计相关 ═══════════════════

export interface StatsOverview {
  totalStudied: number;
  accuracy: number;
  streakDays: number;
  todayStudied: number;
  todayAccuracy: number;
}

export interface RadarData {
  section: string;
  score: number;
  fullMark: number;
}

export interface TrendData {
  date: string;
  accuracy: number;
  count: number;
}

// ═══════════════════ 爬虫相关 ═══════════════════

export type ScrapingStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScrapingProgress {
  taskId: string;
  status: ScrapingStatus;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentUrl?: string;
}

// ═══════════════════ 设置相关 ═══════════════════

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  autoPlayAudio: boolean;
  audioSpeed: number;
  dailyGoalMinutes: number;
  showExplanation: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 14,
  autoPlayAudio: true,
  audioSpeed: 1,
  dailyGoalMinutes: 30,
  showExplanation: true,
};
