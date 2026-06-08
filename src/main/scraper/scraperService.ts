/**
 * 爬虫服务 — 题源管理、数据抓取、任务调度
 *
 * 架构：Plugin-based Parser
 * - Parser 负责解析特定网站的题目格式
 * - Scraper 负责抓取页面内容
 * - TaskManager 负责任务调度和状态管理
 */

import { PrismaClient } from '@prisma/client';
import log from 'electron-log';

// ═══════════════════ 类型 ═══════════════════

export interface ScrapingSource {
  id: string;
  name: string;
  url: string;
  type: 'web' | 'api' | 'file';
  parser: string;
  enabled: boolean;
  lastSyncAt?: string;
}

export interface ScrapingTask {
  id: string;
  sourceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  completedItems: number;
  failedItems: number;
  startedAt?: string;
  completedAt?: string;
  errorSummary?: string;
}

export interface ScrapingResult {
  taskId: string;
  imported: number;
  skipped: number;
  rejected: number;
  errors: Array<{ url: string; error: string }>;
}

// ═══════════════════ 预定义题源 ═══════════════════

export const DEFAULT_SOURCES: ScrapingSource[] = [
  {
    id: 'cet6-2024-06',
    name: 'CET6 2024年6月真题',
    url: 'https://example.com/cet6/2024-06',
    type: 'web',
    parser: 'exam-paper',
    enabled: true,
  },
  {
    id: 'cet6-2024-12',
    name: 'CET6 2024年12月真题',
    url: 'https://example.com/cet6/2024-12',
    type: 'web',
    parser: 'exam-paper',
    enabled: true,
  },
  {
    id: 'cet6-vocab',
    name: 'CET6 核心词汇',
    url: 'https://example.com/cet6/vocab',
    type: 'api',
    parser: 'vocab-list',
    enabled: false,
  },
];

// ═══════════════════ 任务管理 ═══════════════════

// 内存中的任务状态（生产环境可用 Redis）
const activeTasks = new Map<string, ScrapingTask>();

/**
 * 获取所有题源
 */
export async function getSources(
  prisma: PrismaClient
): Promise<ScrapingSource[]> {
  // 从数据库获取用户添加的题源
  const dbSources = await prisma.scrapingTask.findMany({
    select: { sourceId: true },
    distinct: ['sourceId'],
  });

  const dbSourceIds = new Set(dbSources.map(s => s.sourceId));

  // 合并预定义题源和数据库题源
  const sources = [...DEFAULT_SOURCES];

  // 标记已同步的题源
  for (const source of sources) {
    if (dbSourceIds.has(source.id)) {
      const lastTask = await prisma.scrapingTask.findFirst({
        where: { sourceId: source.id },
        orderBy: { createdAt: 'desc' },
        select: { completedAt: true },
      });
      if (lastTask?.completedAt) {
        source.lastSyncAt = lastTask.completedAt.toISOString();
      }
    }
  }

  return sources;
}

/**
 * 创建抓取任务
 */
export async function createTask(
  prisma: PrismaClient,
  sourceId: string
): Promise<ScrapingTask> {
  // 检查是否有运行中的任务
  const runningTask = Array.from(activeTasks.values()).find(
    t => t.sourceId === sourceId && t.status === 'running'
  );

  if (runningTask) {
    throw new Error('该题源有正在运行的任务');
  }

  const task = await prisma.scrapingTask.create({
    data: {
      sourceId,
      status: 'pending',
      totalItems: 0,
      completedItems: 0,
      failedItems: 0,
    },
  });

  const scrapingTask: ScrapingTask = {
    id: task.id,
    sourceId: task.sourceId,
    status: 'pending',
    totalItems: 0,
    completedItems: 0,
    failedItems: 0,
  };

  activeTasks.set(task.id, scrapingTask);
  return scrapingTask;
}

/**
 * 启动抓取任务（模拟）
 */
export async function startTask(
  prisma: PrismaClient,
  taskId: string
): Promise<void> {
  const task = activeTasks.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  task.status = 'running';
  task.startedAt = new Date().toISOString();
  task.totalItems = 10; // 模拟总数

  await prisma.scrapingTask.update({
    where: { id: taskId },
    data: {
      status: 'running',
      startedAt: new Date(),
      totalItems: 10,
    },
  });

  // 模拟抓取过程（实际应该用 HTTP 请求 + Parser）
  log.info(`[Scraper] 开始抓取任务 ${taskId}`);

  // 这里应该：
  // 1. 获取题源 URL
  // 2. 发送 HTTP 请求
  // 3. 使用 Parser 解析内容
  // 4. 提取题目数据
  // 5. 调用 importService 导入

  // 模拟完成
  setTimeout(async () => {
    task.status = 'completed';
    task.completedItems = 10;
    task.completedAt = new Date().toISOString();

    await prisma.scrapingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedItems: 10,
        completedAt: new Date(),
      },
    });

    activeTasks.delete(taskId);
    log.info(`[Scraper] 任务 ${taskId} 完成`);
  }, 2000);
}

/**
 * 取消任务
 */
export async function cancelTask(
  prisma: PrismaClient,
  taskId: string
): Promise<void> {
  const task = activeTasks.get(taskId);
  if (task) {
    task.status = 'cancelled';
    activeTasks.delete(taskId);
  }

  await prisma.scrapingTask.update({
    where: { id: taskId },
    data: { status: 'cancelled' },
  });
}

/**
 * 获取任务列表
 */
export async function getTasks(
  prisma: PrismaClient,
  sourceId?: string
): Promise<ScrapingTask[]> {
  const where = sourceId ? { sourceId } : {};

  const tasks = await prisma.scrapingTask.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return tasks.map(t => ({
    id: t.id,
    sourceId: t.sourceId,
    status: t.status,
    totalItems: t.totalItems,
    completedItems: t.completedItems,
    failedItems: t.failedItems,
    startedAt: t.startedAt?.toISOString(),
    completedAt: t.completedAt?.toISOString(),
    errorSummary: t.errorSummary || undefined,
  }));
}

/**
 * 获取单个任务详情
 */
export async function getTaskDetail(
  prisma: PrismaClient,
  taskId: string
): Promise<ScrapingTask | null> {
  const task = await prisma.scrapingTask.findUnique({
    where: { id: taskId },
    include: {
      failLogs: {
        take: 10,
        orderBy: { failedAt: 'desc' },
      },
    },
  });

  if (!task) return null;

  return {
    id: task.id,
    sourceId: task.sourceId,
    status: task.status,
    totalItems: task.totalItems,
    completedItems: task.completedItems,
    failedItems: task.failedItems,
    startedAt: task.startedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    errorSummary: task.errorSummary || undefined,
  };
}

/**
 * 获取失败日志
 */
export async function getFailLogs(
  prisma: PrismaClient,
  taskId: string
): Promise<Array<{
  id: string;
  url: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  failedAt: string;
}>> {
  const logs = await prisma.scrapingFailLog.findMany({
    where: { taskId },
    orderBy: { failedAt: 'desc' },
    take: 50,
  });

  return logs.map(l => ({
    id: l.id,
    url: l.url,
    errorCode: l.errorCode,
    errorMessage: l.errorMessage,
    retryCount: l.retryCount,
    failedAt: l.failedAt.toISOString(),
  }));
}
