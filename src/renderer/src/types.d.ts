// renderer 全局类型声明

interface CET6API {
  // Home
  homeData: () => Promise<{
    tasks: Array<{
      type: 'practice' | 'review' | 'wrongbook';
      title: string;
      description: string;
      count: number;
      action: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    stats: {
      totalQuestions: number;
      todayPracticed: number;
      accuracy: number;
      streakDays: number;
      dueForReview: number;
      wrongCount: number;
    };
    recentActivity: Array<{
      id: string;
      type: 'practice' | 'review' | 'import';
      title: string;
      description: string;
      time: string;
    }>;
  }>;
  homeTasks: () => Promise<Array<{
    type: 'practice' | 'review' | 'wrongbook';
    title: string;
    description: string;
    count: number;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }>>;
  homeStats: () => Promise<{
    totalQuestions: number;
    todayPracticed: number;
    accuracy: number;
    streakDays: number;
    dueForReview: number;
    wrongCount: number;
  }>;
  homeActivity: (limit?: number) => Promise<Array<{
    id: string;
    type: 'practice' | 'review' | 'import';
    title: string;
    description: string;
    time: string;
  }>>;

  // Settings
  settingsGet: () => Promise<{
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    autoPlayAudio: boolean;
    showExplanation: boolean;
    dailyGoal: number;
    reviewRemind: boolean;
    soundEffect: boolean;
    exportPath: string;
  }>;
  settingsSave: (settings: Record<string, unknown>) => Promise<boolean>;
  settingsAppInfo: () => Promise<{
    version: string;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
    databasePath: string;
    dataSize: string;
  }>;
  settingsExport: (exportPath: string) => Promise<{ success: boolean; path: string; error?: string }>;
  settingsImport: (filePath: string) => Promise<{ success: boolean; imported: number; error?: string }>;
  settingsClear: (options: { studyRecords?: boolean; wrongQuestions?: boolean; all?: boolean }) => Promise<{ success: boolean; deleted: number; error?: string }>;

  // Questions
  questionList: (filters?: Record<string, unknown>) => Promise<unknown[]>;
  questionGet: (id: string) => Promise<unknown>;
  questionImport: (data: { filePath?: string; jsonString?: string }) => Promise<{
    imported: number;
    skipped: number;
    rejected: number;
    errors: Array<{ index: number; code: string; message: string }>;
  }>;

  // Practice
  practiceStart: (config: unknown) => Promise<{ sessionId: string; questionIds: string[] }>;
  practiceQuestion: (sessionId: string) => Promise<{ question: unknown; index: number; total: number; results: unknown[] } | null>;
  practiceSubmit: (sessionId: string, answer: unknown) => Promise<{ isCorrect: boolean; correctAnswer: string }>;
  practiceComplete: (sessionId: string) => Promise<{ totalQuestions: number; correctCount: number; accuracy: number; totalTimeMs: number; results: unknown[] }>;

  // Review
  reviewHistory: (options?: { limit?: number; offset?: number }) => Promise<Array<{
    date: string;
    records: Array<{
      id: string;
      questionId: string;
      rating: number;
      responseTimeMs: number;
      isCorrect: boolean;
      studiedAt: string;
      question: { questionType: string; section: string; content: string; correctAnswer: string; explanation: string | null };
    }>;
    totalCount: number;
    correctCount: number;
    accuracy: number;
  }>>;
  reviewWrongQuestions: (options?: { section?: string; mastered?: boolean; limit?: number; offset?: number }) => Promise<Array<{
    id: string;
    questionId: string;
    wrongCount: number;
    lastWrongAt: string;
    mastered: boolean;
    notes: string | null;
    question: { questionType: string; section: string; difficulty: number; content: string; options: string | null; correctAnswer: string; explanation: string | null };
  }>>;
  reviewStats: () => Promise<{
    totalSessions: number;
    totalQuestions: number;
    overallAccuracy: number;
    avgTimeMs: number;
    sectionStats: Array<{ section: string; totalCount: number; correctCount: number; accuracy: number; avgTimeMs: number }>;
    recentTrend: Array<{ date: string; count: number; accuracy: number }>;
  }>;
  reviewDetail: (sessionId: string) => Promise<{
    sessionId: string;
    date: string;
    totalTimeMs: number;
    records: Array<{
      id: string;
      questionId: string;
      rating: number;
      responseTimeMs: number;
      isCorrect: boolean;
      studiedAt: string;
      question: { questionType: string; section: string; content: string; correctAnswer: string; explanation: string | null };
    }>;
  } | null>;
  reviewMaster: (wrongQuestionId: string) => Promise<boolean>;
  reviewAddNote: (data: { wrongQuestionId: string; notes: string }) => Promise<boolean>;

  // WrongBook
  wrongbookDue: (limit?: number) => Promise<Array<{
    id: string;
    questionId: string;
    wrongCount: number;
    lastWrongAt: string;
    mastered: boolean;
    notes: string | null;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    state: string;
    due: string;
    question: { questionType: string; section: string; difficulty: number; content: string; options: string | null; correctAnswer: string; explanation: string | null; knowledgePoints: string };
  }>>;
  wrongbookReview: (data: { wrongQuestionId: string; rating: number }) => Promise<{
    card: { id: string; stability: number; difficulty: number; due: Date };
    previousStability: number;
    newStability: number;
    previousDifficulty: number;
    newDifficulty: number;
    nextReview: Date;
  }>;
  wrongbookBatchReview: (reviews: Array<{ wrongQuestionId: string; rating: number }>) => Promise<Array<{
    card: { id: string; stability: number; difficulty: number; due: Date };
    previousStability: number;
    newStability: number;
    previousDifficulty: number;
    newDifficulty: number;
    nextReview: Date;
  }>>;
  wrongbookStats: () => Promise<{
    totalWrong: number;
    mastered: number;
    dueForReview: number;
    averageStability: number;
    averageDifficulty: number;
    bySection: Array<{ section: string; count: number; mastered: number; dueForReview: number }>;
  }>;
  wrongbookNote: (data: { wrongQuestionId: string; notes: string }) => Promise<boolean>;
  wrongbookMaster: (wrongQuestionId: string) => Promise<boolean>;
  wrongbookBatchMaster: (wrongQuestionIds: string[]) => Promise<boolean>;
  wrongbookRemove: (wrongQuestionId: string) => Promise<boolean>;
  wrongbookBatchRemove: (wrongQuestionIds: string[]) => Promise<boolean>;

  // Stats
  statsOverview: () => Promise<{
    currentStreak: number;
    longestStreak: number;
    todayStudied: number;
    todayAccuracy: number;
  }>;
  statsTrend: (days?: number) => Promise<Array<{
    date: string;
    count: number;
    accuracy: number;
    avgTime: number;
  }>>;
  statsRadar: () => Promise<Array<{
    section: string;
    accuracy: number;
    total: number;
    correct: number;
  }>>;
  statsDifficulty: () => Promise<Array<{
    difficulty: number;
    count: number;
    accuracy: number;
  }>>;
  statsTime: () => Promise<Array<{
    range: string;
    count: number;
    accuracy: number;
  }>>;
  statsMastery: (days?: number) => Promise<Array<{
    date: string;
    mastered: number;
    total: number;
    masteryRate: number;
  }>>;
  statsHeatmap: (days?: number) => Promise<Array<{
    date: string;
    count: number;
  }>>;
  statsWrongTrend: (days?: number) => Promise<Array<{
    date: string;
    newWrong: number;
    mastered: number;
    total: number;
  }>>;
  statsComprehensive: () => Promise<{
    overview: {
      totalQuestions: number;
      totalCorrect: number;
      accuracy: number;
      avgTimeMs: number;
      totalDays: number;
      studyDays: number;
    };
    streak: { currentStreak: number; longestStreak: number; todayStudied: number; todayAccuracy: number };
    trend: Array<{ date: string; count: number; accuracy: number; avgTime: number }>;
    sectionAccuracy: Array<{ section: string; accuracy: number; total: number; correct: number }>;
    difficultyDistribution: Array<{ difficulty: number; count: number; accuracy: number }>;
    timeDistribution: Array<{ range: string; count: number; accuracy: number }>;
    masteryProgress: Array<{ date: string; mastered: number; total: number; masteryRate: number }>;
    heatmap: Array<{ date: string; count: number }>;
    wrongTrend: Array<{ date: string; newWrong: number; mastered: number; total: number }>;
  }>;

  // Scraper
  scraperSources: () => Promise<Array<{
    id: string;
    name: string;
    url: string;
    type: 'web' | 'api' | 'file';
    parser: string;
    enabled: boolean;
    lastSyncAt?: string;
  }>>;
  scraperCreateTask: (sourceId: string) => Promise<{
    id: string;
    sourceId: string;
    status: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
  }>;
  scraperStartTask: (taskId: string) => Promise<boolean>;
  scraperCancelTask: (taskId: string) => Promise<boolean>;
  scraperTasks: (sourceId?: string) => Promise<Array<{
    id: string;
    sourceId: string;
    status: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    startedAt?: string;
    completedAt?: string;
    errorSummary?: string;
  }>>;
  scraperTaskDetail: (taskId: string) => Promise<{
    id: string;
    sourceId: string;
    status: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    startedAt?: string;
    completedAt?: string;
    errorSummary?: string;
  } | null>;
  scraperFailLogs: (taskId: string) => Promise<Array<{
    id: string;
    url: string;
    errorCode: string;
    errorMessage: string;
    retryCount: number;
    failedAt: string;
  }>>;

  // Gamification
  gameProfile: () => Promise<{
    level: number;
    experience: number;
    nextLevelExp: number;
    totalPoints: number;
    streakDays: number;
    achievements: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      reward: number;
      unlocked: boolean;
      unlockedAt?: string;
      progress: number;
      target: number;
    }>;
    recentAchievements: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      reward: number;
      unlocked: boolean;
      unlockedAt?: string;
      progress: number;
      target: number;
    }>;
  }>;
  gameAddExp: (data: { amount: number; reason: string }) => Promise<{
    newTotal: number;
    levelUp: boolean;
    newLevel?: number;
  }>;
  gameLeaderboard: () => Promise<Array<{
    rank: number;
    level: number;
    title: string;
    experience: number;
    streak: number;
  }>>;

  // App
  appVersion: () => Promise<string>;
  appQuit: () => void;
}

declare global {
  interface Window {
    api: CET6API;
  }
}

export {};
