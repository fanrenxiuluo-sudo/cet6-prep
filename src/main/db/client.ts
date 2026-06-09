import { PrismaClient } from '@prisma/client';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let prisma: PrismaClient | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'cet6-prep.db');
}

/**
 * 获取 Prisma engine 的正确路径
 * asar: false 时，node_modules 直接在 resources/app/ 下
 */
function getPrismaEnginePath(): string {
  return path.join(app.getAppPath(), 'node_modules', '@prisma', 'engines', 'query_engine-windows.dll.node');
}

export async function initDatabase(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 设置 Prisma engine 路径
  const enginePath = getPrismaEnginePath();
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_BINARY = enginePath;
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });

  // 首次运行时自动创建数据库表
  await ensureSchema(prisma);

  return prisma;
}

/**
 * 使用 $executeRawUnsafe 创建数据库表（IF NOT EXISTS）
 * 在首次运行时自动执行
 */
async function ensureSchema(db: PrismaClient): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "AudioFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "filePath" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "audioMd5" TEXT,
      "durationMs" INTEGER,
      "fileSize" INTEGER,
      "format" TEXT,
      "playable" BOOLEAN NOT NULL DEFAULT true,
      "sourceUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Question" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "questionType" TEXT NOT NULL,
      "section" TEXT NOT NULL,
      "subSection" TEXT,
      "difficulty" INTEGER NOT NULL DEFAULT 3,
      "knowledgePoints" TEXT NOT NULL DEFAULT '[]',
      "content" TEXT NOT NULL,
      "options" TEXT,
      "correctAnswer" TEXT NOT NULL,
      "explanation" TEXT,
      "audioFileId" TEXT,
      "sourceExam" TEXT,
      "examYear" INTEGER,
      "examSession" TEXT,
      "contentHash" TEXT,
      "textSimilarity" TEXT,
      "dataSource" TEXT NOT NULL DEFAULT 'builtin',
      "sourceParser" TEXT,
      "qualityStatus" TEXT NOT NULL DEFAULT 'pending',
      "qualityIssues" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Question_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "AudioFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "StudyRecord" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "questionId" TEXT NOT NULL,
      "rating" INTEGER NOT NULL,
      "responseTimeMs" INTEGER NOT NULL,
      "isCorrect" BOOLEAN NOT NULL,
      "studiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "state" TEXT NOT NULL DEFAULT 'New',
      "dueDate" DATETIME,
      "stability" REAL,
      "difficultyR" REAL,
      "elapsedDays" INTEGER NOT NULL DEFAULT 0,
      "scheduledDays" INTEGER NOT NULL DEFAULT 0,
      "reps" INTEGER NOT NULL DEFAULT 0,
      "reviewed" BOOLEAN NOT NULL DEFAULT false,
      "reviewNotes" TEXT,
      "knowledgePointsMiscovered" TEXT,
      CONSTRAINT "StudyRecord_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "UserStats" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "totalPoints" INTEGER NOT NULL DEFAULT 0,
      "growthValue" REAL NOT NULL DEFAULT 0,
      "level" INTEGER NOT NULL DEFAULT 1,
      "streakDays" INTEGER NOT NULL DEFAULT 0,
      "lastStudyAt" DATETIME,
      "sectionMastery" TEXT NOT NULL DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS "WrongQuestion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "questionId" TEXT NOT NULL,
      "wrongCount" INTEGER NOT NULL DEFAULT 1,
      "lastWrongAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "mastered" BOOLEAN NOT NULL DEFAULT false,
      "notes" TEXT,
      CONSTRAINT "WrongQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "StudyPlan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "date" DATETIME NOT NULL,
      "tasks" TEXT NOT NULL DEFAULT '[]',
      "completed" BOOLEAN NOT NULL DEFAULT false,
      "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "UserSetting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "value" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ScrapingTask" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sourceId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "totalItems" INTEGER NOT NULL DEFAULT 0,
      "completedItems" INTEGER NOT NULL DEFAULT 0,
      "failedItems" INTEGER NOT NULL DEFAULT 0,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
      "errorSummary" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ScrapingFailLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "taskId" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "errorCode" TEXT NOT NULL,
      "errorMessage" TEXT NOT NULL,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "maxRetries" INTEGER NOT NULL DEFAULT 3,
      "contentHash" TEXT,
      "failedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolved" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ScrapingFailLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ScrapingTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ScrapingImportResult" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "taskId" TEXT NOT NULL,
      "questionId" TEXT,
      "status" TEXT NOT NULL,
      "rejectReason" TEXT,
      "dedupInfo" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ScrapingImportResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ScrapingTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
  ];

  for (const sql of statements) {
    await db.$executeRawUnsafe(sql);
  }
}

export function getDb(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return prisma;
}

export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
