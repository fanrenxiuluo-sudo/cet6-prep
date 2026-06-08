/**
 * 去重引擎 — 三维度去重
 *
 * 1. contentHash（SHA-256）：精确匹配
 * 2. textSimilarity（简化版 SimHash）：排版变体检测
 * 3. 音频指纹（MD5）：音频文件去重
 */

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// ═══════════════════ 类型 ═══════════════════

export interface DedupResult {
  isDuplicate: boolean;
  matchType: 'exact' | 'similar' | 'audio' | null;
  matchedId: string | null;
  confidence: number; // 0-1
}

// ═══════════════════ Content Hash ═══════════════════

/**
 * 计算题目 contentHash（SHA-256）
 * 输入：examYear + examSession + questionType + normalize(stem) + normalize(options) + normalize(answer)
 */
export function computeContentHash(params: {
  examYear?: number | null;
  examSession?: string | null;
  questionType: string;
  stem: string;
  options?: string;
  correctAnswer: string;
}): string {
  const raw = [
    params.examYear ?? '',
    params.examSession ?? '',
    params.questionType,
    normalizeText(params.stem),
    normalizeText(params.options ?? ''),
    normalizeText(params.correctAnswer),
  ].join('|');

  return createHash('sha256').update(raw).digest('hex');
}

// ═══════════════════ 文本相似度（简化 SimHash） ═══════════════════

/**
 * 计算文本的 SimHash 指纹（简化版）
 * 返回 64-bit 整数的十六进制字符串
 */
export function computeSimHash(text: string): string {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);

  // 64-bit 位向量
  const vector = new Array(64).fill(0);

  for (const token of tokens) {
    const tokenHash = createHash('md5').update(token).digest();
    for (let i = 0; i < 64; i++) {
      const bit = (tokenHash[Math.floor(i / 8)] >> (i % 8)) & 1;
      vector[i] += bit === 1 ? 1 : -1;
    }
  }

  // 生成 fingerprint
  let fingerprint = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (vector[i] > 0) {
      fingerprint |= BigInt(1) << BigInt(i);
    }
  }

  return fingerprint.toString(16).padStart(16, '0');
}

/**
 * 计算两个 SimHash 之间的汉明距离
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const b1 = BigInt('0x' + hash1);
  const b2 = BigInt('0x' + hash2);
  let xor = b1 ^ b2;
  let distance = 0;
  while (xor > BigInt(0)) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return distance;
}

/**
 * 基于 SimHash 判断两段文本是否相似
 * 汉明距离 <= threshold 视为相似
 */
export function isSimilarText(hash1: string, hash2: string, threshold = 3): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

// ═══════════════════ 数据库去重查询 ═══════════════════

/**
 * 对一道待导入题目执行去重检查
 * 按优先级：精确匹配 → 相似匹配
 */
export async function checkDuplicate(
  prisma: PrismaClient,
  params: {
    contentHash: string;
    stemSimHash: string;
  }
): Promise<DedupResult> {
  // 1. 精确匹配：contentHash
  const exactMatch = await prisma.question.findFirst({
    where: { contentHash: params.contentHash },
    select: { id: true },
  });

  if (exactMatch) {
    return {
      isDuplicate: true,
      matchType: 'exact',
      matchedId: exactMatch.id,
      confidence: 1.0,
    };
  }

  // 2. 相似匹配：从 DB 读取同类型题目的 SimHash 比对
  // （生产环境建议用 LSH 分桶优化，这里简化为全量扫描 + 汉明距离）
  const candidates = await prisma.question.findMany({
    select: { id: true, textSimilarity: true },
    take: 5000, // 限制扫描量
  });

  for (const c of candidates) {
    if (!c.textSimilarity) continue;
    const storedHash = safeParse(c.textSimilarity) as { stemFingerprint?: string } | null;
    if (!storedHash?.stemFingerprint) continue;

    if (isSimilarText(params.stemSimHash, storedHash.stemFingerprint)) {
      return {
        isDuplicate: true,
        matchType: 'similar',
        matchedId: c.id,
        confidence: 0.85,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: null,
    matchedId: null,
    confidence: 0,
  };
}

// ═══════════════════ 音频指纹 ═══════════════════

/**
 * 计算音频文件的 MD5 指纹
 */
export function computeAudioFingerprint(buffer: Buffer): string {
  return createHash('md5').update(buffer).digest('hex');
}

/**
 * 在数据库中检查音频是否已存在
 */
export async function checkAudioDuplicate(
  prisma: PrismaClient,
  md5: string,
  durationMs?: number
): Promise<string | null> {
  const where: Record<string, unknown> = { audioMd5: md5 };
  if (durationMs) where.durationMs = durationMs;

  const existing = await prisma.audioFile.findFirst({
    where,
    select: { id: true },
  });

  return existing?.id ?? null;
}

// ═══════════════════ 工具函数 ═══════════════════

/**
 * 文本标准化：去标点、统一空白、转小写
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s一-鿿]/g, '') // 保留中英文字符和空格
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  // 中英文分词：英文按空格，中文按字
  const tokens: string[] = [];
  const enWords = text.match(/[a-z0-9]+/g) || [];
  const zhChars = text.match(/[一-鿿]/g) || [];
  tokens.push(...enWords, ...zhChars);
  return tokens;
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return null; }
}
