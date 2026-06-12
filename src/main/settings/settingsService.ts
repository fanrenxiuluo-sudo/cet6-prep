/**
 * 设置服务 — 用户配置管理、主题切换、数据导出
 */

import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import log from 'electron-log';
import fs from 'node:fs';
import path from 'node:path';

// ═══════════════════ 类型 ═══════════════════

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  autoPlayAudio: boolean;
  showExplanation: boolean;
  dailyGoal: number;
  reviewRemind: boolean;
  soundEffect: boolean;
  exportPath: string;
}

export interface AppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  databasePath: string;
  dataSize: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  fontSize: 14,
  autoPlayAudio: true,
  showExplanation: true,
  dailyGoal: 20,
  reviewRemind: true,
  soundEffect: true,
  exportPath: '',
};

// ═══════════════════ 获取设置 ═══════════════════

export async function getSettings(
  prisma: PrismaClient
): Promise<UserSettings> {
  const settings = await prisma.userSetting.findMany();
  const settingsMap = settings.reduce((acc, s) => {
    acc[s.key] = JSON.parse(s.value);
    return acc;
  }, {} as Record<string, unknown>);

  return {
    ...DEFAULT_SETTINGS,
    ...settingsMap,
  } as UserSettings;
}

// ═══════════════════ 保存设置 ═══════════════════

export async function saveSettings(
  prisma: PrismaClient,
  settings: Partial<UserSettings>
): Promise<boolean> {
  try {
    for (const [key, value] of Object.entries(settings)) {
      await prisma.userSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
    }
    return true;
  } catch (error) {
    log.error('Failed to save settings:', error);
    return false;
  }
}

// ═══════════════════ 获取应用信息 ═══════════════════

export async function getAppInfo(
  prisma: PrismaClient
): Promise<AppInfo> {
  const dbPath = app.getPath('userData');
  const dbFile = path.join(dbPath, 'cet6-prep.db');

  // 计算数据库大小
  let dataSize = '未知';
  try {
    if (fs.existsSync(dbFile)) {
      const stats = fs.statSync(dbFile);
      dataSize = formatBytes(stats.size);
    }
  } catch (error) {
    log.error('Failed to get db size:', error);
  }

  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron || '未知',
    chromeVersion: process.versions.chrome || '未知',
    nodeVersion: process.versions.node || '未知',
    databasePath: dbPath,
    dataSize,
  };
}

// ═══════════════════ 数据导出 ═══════════════════

/**
 * 完整导出：包含所有用户相关数据（题目/学习/错题/成就/计划/爬虫历史/设置）
 * 文件名包含 schemaVersion 与时间戳，方便后续兼容
 */
export async function exportData(
  prisma: PrismaClient,
  exportPath: string
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    if (!exportPath || !fs.existsSync(exportPath)) {
      return { success: false, path: '', error: '导出目录不存在或未填写' };
    }

    const [
      questions,
      audioFiles,
      studyRecords,
      wrongQuestions,
      userStats,
      studyPlans,
      userSettings,
      scrapingTasks,
      scrapingFailLogs,
      scrapingImportResults,
    ] = await Promise.all([
      prisma.question.findMany(),
      prisma.audioFile.findMany(),
      prisma.studyRecord.findMany(),
      prisma.wrongQuestion.findMany(),
      prisma.userStats.findMany(),
      prisma.studyPlan.findMany(),
      prisma.userSetting.findMany(),
      prisma.scrapingTask.findMany(),
      prisma.scrapingFailLog.findMany(),
      prisma.scrapingImportResult.findMany(),
    ]);

    const data = {
      schemaVersion: 2,
      exportTime: new Date().toISOString(),
      app: {
        name: 'CET6备考助手',
        version: app.getVersion(),
      },
      questions,
      audioFiles,
      studyRecords,
      wrongQuestions,
      userStats,
      studyPlans,
      userSettings,
      scrapingTasks,
      scrapingFailLogs,
      scrapingImportResults,
    };

    const filePath = path.join(exportPath, `cet6-prep-backup-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log.error('Export failed:', error);
    return { success: false, path: '', error: errorMessage };
  }
}

// ═══════════════════ 数据导入 ═══════════════════

/**
 * 真实导入：upsert 题目/学习记录/错题/设置/成就；爬虫历史可选
 */
export async function importData(
  prisma: PrismaClient,
  filePath: string
): Promise<{ success: boolean; imported: number; error?: string; detail?: Record<string, number> }> {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, imported: 0, error: '导入文件不存在' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(content) as Record<string, unknown>;
    } catch (e) {
      return { success: false, imported: 0, error: 'JSON 解析失败：' + (e as Error).message };
    }

    const detail: Record<string, number> = {
      questions: 0,
      audioFiles: 0,
      studyRecords: 0,
      wrongQuestions: 0,
      userStats: 0,
      studyPlans: 0,
      userSettings: 0,
    };

    // 1. 音频文件（被 question 引用，先建）
    if (Array.isArray(data.audioFiles)) {
      for (const a of data.audioFiles as Array<Record<string, unknown>>) {
        try {
          await prisma.audioFile.upsert({
            where: { id: a.id as string },
            update: a,
            create: a as never,
          });
          detail.audioFiles++;
        } catch { /* skip */ }
      }
    }

    // 2. 题目（按 id upsert，保留原 ID 以支持复用 wrongQuestion/studyRecord 关联）
    if (Array.isArray(data.questions)) {
      for (const q of data.questions as Array<Record<string, unknown>>) {
        try {
          await prisma.question.upsert({
            where: { id: q.id as string },
            update: q,
            create: q as never,
          });
          detail.questions++;
        } catch { /* skip */ }
      }
    }

    // 3. 用户设置
    if (Array.isArray(data.userSettings)) {
      for (const s of data.userSettings as Array<{ key: string; value: string }>) {
        try {
          await prisma.userSetting.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: { key: s.key, value: s.value },
          });
          detail.userSettings++;
        } catch { /* skip */ }
      }
    }

    // 4. 学习记录
    if (Array.isArray(data.studyRecords)) {
      for (const r of data.studyRecords as Array<Record<string, unknown>>) {
        try {
          await prisma.studyRecord.upsert({
            where: { id: r.id as string },
            update: r,
            create: r as never,
          });
          detail.studyRecords++;
        } catch { /* skip — 多数情况下 question 不存在或重复 */ }
      }
    }

    // 5. 错题
    if (Array.isArray(data.wrongQuestions)) {
      for (const w of data.wrongQuestions as Array<Record<string, unknown>>) {
        try {
          await prisma.wrongQuestion.upsert({
            where: { id: w.id as string },
            update: w,
            create: w as never,
          });
          detail.wrongQuestions++;
        } catch { /* skip */ }
      }
    }

    // 6. 用户统计（成就 / 等级）
    if (Array.isArray(data.userStats)) {
      for (const u of data.userStats as Array<Record<string, unknown>>) {
        try {
          await prisma.userStats.upsert({
            where: { id: u.id as string },
            update: u,
            create: u as never,
          });
          detail.userStats++;
        } catch { /* skip */ }
      }
    }

    // 7. 学习计划
    if (Array.isArray(data.studyPlans)) {
      for (const p of data.studyPlans as Array<Record<string, unknown>>) {
        try {
          await prisma.studyPlan.upsert({
            where: { id: p.id as string },
            update: p,
            create: p as never,
          });
          detail.studyPlans++;
        } catch { /* skip */ }
      }
    }

    const imported = Object.values(detail).reduce((a, b) => a + b, 0);
    return { success: true, imported, detail };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log.error('Import failed:', error);
    return { success: false, imported: 0, error: errorMessage };
  }
}

// ═══════════════════ 清除数据 ═══════════════════

export async function clearData(
  prisma: PrismaClient,
  options: {
    studyRecords?: boolean;
    wrongQuestions?: boolean;
    all?: boolean;
  }
): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    let deleted = 0;

    if (options.all || options.studyRecords) {
      const result = await prisma.studyRecord.deleteMany();
      deleted += result.count;
    }

    if (options.all || options.wrongQuestions) {
      const result = await prisma.wrongQuestion.deleteMany();
      deleted += result.count;
    }

    return { success: true, deleted };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return { success: false, deleted: 0, error: errorMessage };
  }
}

// ═══════════════════ 工具函数 ═══════════════════

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
