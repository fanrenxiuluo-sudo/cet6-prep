import { ipcMain, app } from 'electron';
import { getDb } from '../db/client';
import { importFromJsonFile, importFromJsonString } from '../question/importService';
import * as practiceService from '../practice/practiceService';
import * as reviewService from '../review/reviewService';
import * as wrongBookService from '../review/wrongBookService';
import * as statsService from '../stats/statsService';
import * as homeService from '../home/homeService';
import * as settingsService from '../settings/settingsService';
import * as scraperService from '../scraper/scraperService';
import * as gamificationService from '../gamification/gamificationService';

export function registerIpc(): void {
  // ═══════════════════ Home ═══════════════════
  ipcMain.handle('home:data', async () => {
    const db = getDb();
    return homeService.getHomeData(db);
  });

  ipcMain.handle('home:tasks', async () => {
    const db = getDb();
    return homeService.getTodayTasks(db);
  });

  ipcMain.handle('home:stats', async () => {
    const db = getDb();
    return homeService.getQuickStats(db);
  });

  ipcMain.handle('home:activity', async (_event, limit?: number) => {
    const db = getDb();
    return homeService.getRecentActivity(db, limit);
  });

  // ═══════════════════ Settings ═══════════════════
  ipcMain.handle('settings:get', async () => {
    const db = getDb();
    return settingsService.getSettings(db);
  });

  ipcMain.handle('settings:save', async (_event, settings: Record<string, unknown>) => {
    const db = getDb();
    return settingsService.saveSettings(db, settings as any);
  });

  ipcMain.handle('settings:appInfo', async () => {
    const db = getDb();
    return settingsService.getAppInfo(db);
  });

  ipcMain.handle('settings:export', async (_event, exportPath: string) => {
    const db = getDb();
    return settingsService.exportData(db, exportPath);
  });

  ipcMain.handle('settings:import', async (_event, filePath: string) => {
    const db = getDb();
    return settingsService.importData(db, filePath);
  });

  ipcMain.handle('settings:clear', async (_event, options: { studyRecords?: boolean; wrongQuestions?: boolean; all?: boolean }) => {
    const db = getDb();
    return settingsService.clearData(db, options);
  });

  // ═══════════════════ Questions ═══════════════════
  ipcMain.handle('question:list', async (_event, filters?: Record<string, unknown>) => {
    const db = getDb();
    const where: Record<string, unknown> = {};
    if (filters?.section) where.section = filters.section;
    if (filters?.questionType) where.questionType = filters.questionType;
    if (filters?.examYear) where.examYear = filters.examYear;
    if (filters?.difficulty) where.difficulty = filters.difficulty;

    return db.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: (filters?.limit as number) || 50,
    });
  });

  ipcMain.handle('question:get', async (_event, id: string) => {
    const db = getDb();
    return db.question.findUnique({ where: { id } });
  });

  ipcMain.handle('question:import', async (_event, data: { filePath?: string; jsonString?: string }) => {
    const db = getDb();
    if (data.filePath) {
      return importFromJsonFile(db, data.filePath);
    }
    if (data.jsonString) {
      return importFromJsonString(db, data.jsonString);
    }
    return { imported: 0, skipped: 0, rejected: 0, errors: [{ code: 'NO_DATA', message: '未提供导入数据' }] };
  });

  // ═══════════════════ Practice ═══════════════════
  ipcMain.handle('practice:start', async (_event, config: practiceService.StartConfig) => {
    const db = getDb();
    return practiceService.startSession(db, config);
  });

  ipcMain.handle('practice:question', async (_event, sessionId: string) => {
    const db = getDb();
    return practiceService.getCurrentQuestion(db, sessionId);
  });

  ipcMain.handle('practice:submit', async (_event, sessionId: string, answer: practiceService.SubmitAnswer) => {
    const db = getDb();
    return practiceService.submitAnswer(db, sessionId, answer);
  });

  ipcMain.handle('practice:complete', async (_event, sessionId: string) => {
    const db = getDb();
    return practiceService.completeSession(db, sessionId);
  });

  // ═══════════════════ Review ═══════════════════
  ipcMain.handle('review:history', async (_event, options?: { limit?: number; offset?: number }) => {
    const db = getDb();
    return reviewService.getStudyHistory(db, options);
  });

  ipcMain.handle('review:wrongQuestions', async (_event, options?: {
    section?: string;
    mastered?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const db = getDb();
    return reviewService.getWrongQuestions(db, options);
  });

  ipcMain.handle('review:stats', async () => {
    const db = getDb();
    return reviewService.getOverviewStats(db);
  });

  ipcMain.handle('review:detail', async (_event, sessionId: string) => {
    const db = getDb();
    return reviewService.getSessionDetail(db, sessionId);
  });

  ipcMain.handle('review:master', async (_event, wrongQuestionId: string) => {
    const db = getDb();
    await reviewService.markAsMastered(db, wrongQuestionId);
    return true;
  });

  ipcMain.handle('review:addNote', async (_event, data: { wrongQuestionId: string; notes: string }) => {
    const db = getDb();
    await reviewService.addWrongQuestionNote(db, data.wrongQuestionId, data.notes);
    return true;
  });

  // ═══════════════════ WrongBook ═══════════════════
  ipcMain.handle('wrongbook:due', async (_event, limit?: number) => {
    const db = getDb();
    return wrongBookService.getDueForReview(db, limit);
  });

  ipcMain.handle('wrongbook:review', async (_event, data: { wrongQuestionId: string; rating: number }) => {
    const db = getDb();
    return wrongBookService.reviewWrongQuestion(db, data.wrongQuestionId, data.rating as 1 | 2 | 3 | 4);
  });

  ipcMain.handle('wrongbook:batchReview', async (_event, reviews: Array<{ wrongQuestionId: string; rating: number }>) => {
    const db = getDb();
    return wrongBookService.batchReview(db, reviews as any);
  });

  ipcMain.handle('wrongbook:stats', async () => {
    const db = getDb();
    return wrongBookService.getWrongBookStats(db);
  });

  ipcMain.handle('wrongbook:note', async (_event, data: { wrongQuestionId: string; notes: string }) => {
    const db = getDb();
    await wrongBookService.addNote(db, data.wrongQuestionId, data.notes);
    return true;
  });

  ipcMain.handle('wrongbook:master', async (_event, wrongQuestionId: string) => {
    const db = getDb();
    await wrongBookService.markMastered(db, wrongQuestionId);
    return true;
  });

  ipcMain.handle('wrongbook:batchMaster', async (_event, wrongQuestionIds: string[]) => {
    const db = getDb();
    await wrongBookService.batchMarkMastered(db, wrongQuestionIds);
    return true;
  });

  ipcMain.handle('wrongbook:remove', async (_event, wrongQuestionId: string) => {
    const db = getDb();
    await wrongBookService.removeWrongQuestion(db, wrongQuestionId);
    return true;
  });

  ipcMain.handle('wrongbook:batchRemove', async (_event, wrongQuestionIds: string[]) => {
    const db = getDb();
    await wrongBookService.batchRemove(db, wrongQuestionIds);
    return true;
  });

  // ═══════════════════ Stats ═══════════════════
  ipcMain.handle('stats:overview', async () => {
    const db = getDb();
    return statsService.getStreakData(db);
  });

  ipcMain.handle('stats:trend', async (_event, days?: number) => {
    const db = getDb();
    return statsService.getTrendData(db, days || 30);
  });

  ipcMain.handle('stats:radar', async () => {
    const db = getDb();
    return statsService.getSectionAccuracy(db);
  });

  ipcMain.handle('stats:difficulty', async () => {
    const db = getDb();
    return statsService.getDifficultyDistribution(db);
  });

  ipcMain.handle('stats:time', async () => {
    const db = getDb();
    return statsService.getTimeDistribution(db);
  });

  ipcMain.handle('stats:mastery', async (_event, days?: number) => {
    const db = getDb();
    return statsService.getMasteryProgress(db, days || 30);
  });

  ipcMain.handle('stats:heatmap', async (_event, days?: number) => {
    const db = getDb();
    return statsService.getLearningHeatmap(db, days || 365);
  });

  ipcMain.handle('stats:wrongTrend', async (_event, days?: number) => {
    const db = getDb();
    return statsService.getWrongTrend(db, days || 30);
  });

  ipcMain.handle('stats:comprehensive', async () => {
    const db = getDb();
    return statsService.getComprehensiveStats(db);
  });

  // ═══════════════════ Scraper ═══════════════════
  ipcMain.handle('scraper:sources', async () => {
    const db = getDb();
    return scraperService.getSources(db);
  });

  ipcMain.handle('scraper:createTask', async (_event, sourceId: string) => {
    const db = getDb();
    return scraperService.createTask(db, sourceId);
  });

  ipcMain.handle('scraper:startTask', async (_event, taskId: string) => {
    const db = getDb();
    await scraperService.startTask(db, taskId);
    return true;
  });

  ipcMain.handle('scraper:cancelTask', async (_event, taskId: string) => {
    const db = getDb();
    await scraperService.cancelTask(db, taskId);
    return true;
  });

  ipcMain.handle('scraper:tasks', async (_event, sourceId?: string) => {
    const db = getDb();
    return scraperService.getTasks(db, sourceId);
  });

  ipcMain.handle('scraper:taskDetail', async (_event, taskId: string) => {
    const db = getDb();
    return scraperService.getTaskDetail(db, taskId);
  });

  ipcMain.handle('scraper:failLogs', async (_event, taskId: string) => {
    const db = getDb();
    return scraperService.getFailLogs(db, taskId);
  });

  // ═══════════════════ Gamification ═══════════════════
  ipcMain.handle('game:profile', async () => {
    const db = getDb();
    return gamificationService.getUserProfile(db);
  });

  ipcMain.handle('game:addExp', async (_event, data: { amount: number; reason: string }) => {
    const db = getDb();
    return gamificationService.addExperience(db, data.amount, data.reason);
  });

  ipcMain.handle('game:leaderboard', async () => {
    const db = getDb();
    return gamificationService.getLeaderboard(db);
  });

  // ═══════════════════ App ═══════════════════
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}
