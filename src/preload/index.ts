import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Home
  homeData: () => ipcRenderer.invoke('home:data'),
  homeTasks: () => ipcRenderer.invoke('home:tasks'),
  homeStats: () => ipcRenderer.invoke('home:stats'),
  homeActivity: (limit?: number) => ipcRenderer.invoke('home:activity', limit),

  // Settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),
  settingsAppInfo: () => ipcRenderer.invoke('settings:appInfo'),
  settingsExport: (exportPath: string) => ipcRenderer.invoke('settings:export', exportPath),
  settingsImport: (filePath: string) => ipcRenderer.invoke('settings:import', filePath),
  settingsClear: (options: { studyRecords?: boolean; wrongQuestions?: boolean; all?: boolean }) => ipcRenderer.invoke('settings:clear', options),

  // Questions
  questionList: (filters?: Record<string, unknown>) => ipcRenderer.invoke('question:list', filters),
  questionGet: (id: string) => ipcRenderer.invoke('question:get', id),
  questionImport: (data: unknown) => ipcRenderer.invoke('question:import', data),

  // Practice
  practiceStart: (config: unknown) => ipcRenderer.invoke('practice:start', config),
  practiceQuestion: (sessionId: string) => ipcRenderer.invoke('practice:question', sessionId),
  practiceSubmit: (sessionId: string, answer: unknown) => ipcRenderer.invoke('practice:submit', sessionId, answer),
  practiceComplete: (sessionId: string) => ipcRenderer.invoke('practice:complete', sessionId),

  // Review
  reviewHistory: (options?: { limit?: number; offset?: number }) => ipcRenderer.invoke('review:history', options),
  reviewWrongQuestions: (options?: { section?: string; mastered?: boolean; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('review:wrongQuestions', options),
  reviewStats: () => ipcRenderer.invoke('review:stats'),
  reviewDetail: (sessionId: string) => ipcRenderer.invoke('review:detail', sessionId),
  reviewMaster: (wrongQuestionId: string) => ipcRenderer.invoke('review:master', wrongQuestionId),
  reviewAddNote: (data: { wrongQuestionId: string; notes: string }) => ipcRenderer.invoke('review:addNote', data),

  // WrongBook
  wrongbookDue: (limit?: number) => ipcRenderer.invoke('wrongbook:due', limit),
  wrongbookReview: (data: { wrongQuestionId: string; rating: number }) => ipcRenderer.invoke('wrongbook:review', data),
  wrongbookBatchReview: (reviews: Array<{ wrongQuestionId: string; rating: number }>) => ipcRenderer.invoke('wrongbook:batchReview', reviews),
  wrongbookStats: () => ipcRenderer.invoke('wrongbook:stats'),
  wrongbookNote: (data: { wrongQuestionId: string; notes: string }) => ipcRenderer.invoke('wrongbook:note', data),
  wrongbookMaster: (wrongQuestionId: string) => ipcRenderer.invoke('wrongbook:master', wrongQuestionId),
  wrongbookBatchMaster: (wrongQuestionIds: string[]) => ipcRenderer.invoke('wrongbook:batchMaster', wrongQuestionIds),
  wrongbookRemove: (wrongQuestionId: string) => ipcRenderer.invoke('wrongbook:remove', wrongQuestionId),
  wrongbookBatchRemove: (wrongQuestionIds: string[]) => ipcRenderer.invoke('wrongbook:batchRemove', wrongQuestionIds),

  // Stats
  statsOverview: () => ipcRenderer.invoke('stats:overview'),
  statsTrend: (days?: number) => ipcRenderer.invoke('stats:trend', days),
  statsRadar: () => ipcRenderer.invoke('stats:radar'),
  statsDifficulty: () => ipcRenderer.invoke('stats:difficulty'),
  statsTime: () => ipcRenderer.invoke('stats:time'),
  statsMastery: (days?: number) => ipcRenderer.invoke('stats:mastery', days),
  statsHeatmap: (days?: number) => ipcRenderer.invoke('stats:heatmap', days),
  statsWrongTrend: (days?: number) => ipcRenderer.invoke('stats:wrongTrend', days),
  statsComprehensive: () => ipcRenderer.invoke('stats:comprehensive'),

  // Scraper
  scraperSources: () => ipcRenderer.invoke('scraper:sources'),
  scraperCreateTask: (sourceId: string) => ipcRenderer.invoke('scraper:createTask', sourceId),
  scraperStartTask: (taskId: string) => ipcRenderer.invoke('scraper:startTask', taskId),
  scraperCancelTask: (taskId: string) => ipcRenderer.invoke('scraper:cancelTask', taskId),
  scraperTasks: (sourceId?: string) => ipcRenderer.invoke('scraper:tasks', sourceId),
  scraperTaskDetail: (taskId: string) => ipcRenderer.invoke('scraper:taskDetail', taskId),
  scraperFailLogs: (taskId: string) => ipcRenderer.invoke('scraper:failLogs', taskId),

  // Gamification
  gameProfile: () => ipcRenderer.invoke('game:profile'),
  gameAddExp: (data: { amount: number; reason: string }) => ipcRenderer.invoke('game:addExp', data),
  gameLeaderboard: () => ipcRenderer.invoke('game:leaderboard'),

  // App
  appVersion: () => ipcRenderer.invoke('app:version'),
  appQuit: () => ipcRenderer.invoke('app:quit'),

  // Dialog
  dialogOpenDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  dialogOpenFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:openFile', options),
});

export type CET6API = typeof contextBridge;
