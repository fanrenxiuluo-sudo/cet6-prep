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
 * 关闭 asar 后，文件直接在 resources/app/resources/prisma-engines 下
 */
function getPrismaEnginePath(): string {
  if (app.isPackaged) {
    // 打包后：从 resources/app/resources/prisma-engines 加载
    return path.join(process.resourcesPath, 'app', 'resources', 'prisma-engines', 'query_engine-windows.dll.node');
  }
  // 开发时：从 node_modules 加载
  return path.join(__dirname, '..', '..', 'node_modules', '@prisma', 'engines', 'query_engine-windows.dll.node');
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

  return prisma;
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
