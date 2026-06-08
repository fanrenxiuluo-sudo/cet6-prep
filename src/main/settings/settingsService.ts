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

export async function exportData(
  prisma: PrismaClient,
  exportPath: string
): Promise<{ success: boolean; path: string; error?: string }> {
  try {
    const data = {
      exportTime: new Date().toISOString(),
      questions: await prisma.question.findMany(),
      studyRecords: await prisma.studyRecord.findMany(),
      wrongQuestions: await prisma.wrongQuestion.findMany(),
      userSettings: await prisma.userSetting.findMany(),
    };

    const filePath = path.join(exportPath, `cet6-prep-backup-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return { success: false, path: '', error: errorMessage };
  }
}

// ═══════════════════ 数据导入 ═══════════════════

export async function importData(
  prisma: PrismaClient,
  filePath: string
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    let imported = 0;

    // 导入题目
    if (data.questions && Array.isArray(data.questions)) {
      for (const q of data.questions) {
        try {
          await prisma.question.upsert({
            where: { id: q.id },
            update: q,
            create: q,
          });
          imported++;
        } catch (e) {
          // 跳过重复题目
        }
      }
    }

    return { success: true, imported };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
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
