/**
 * FSRS (Free Spaced Repetition Scheduler) v4.1
 * 简化版实现，用于错题复习调度
 *
 * 核心概念：
 * - Stability: 稳定性（记忆保持天数）
 * - Difficulty: 难度因子
 * - Retrievability: 可检索性（当前回忆概率）
 *
 * 参考：https://github.com/open-spaced-repetition/fsrs4anki/wiki
 */

export interface Card {
  id: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  due: Date;
}

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

// FSRS 默认参数
const DEFAULT_PARAMETERS = {
  requestRetention: 0.9, // 目标保持率
  maximumInterval: 36500, // 最大间隔（天）
  w: [
    0.4072, 0.6530, 0.8163, 1.1144, 1.2608, 1.3291, // 初始稳定性
    1.3291, // 初始难度
    0.0047, 0.0127, 0.0637, 0.1288, 0.1904, // 难度权重
    0.2304, 0.2348, 0.2818, 0.2940, // 难度因子
    0.0556, 0.0850, 0.1095, 0.1400, // 稳定性权重
    0.2130, 0.2304, 0.2442, 0.2818, // 稳定性因子
    0.6117, 0.2381, 0.1442, 0.0819, // 间隔权重
    0.7534, 0.0, 0.0, 0.0, // 额外参数
  ],
};

// ═══════════════════ 核心算法 ═══════════════════

/**
 * 计算初始稳定性（Rating -> Stability）
 * 当卡片首次学习时使用
 */
function initialStability(rating: Rating): number {
  const w = DEFAULT_PARAMETERS.w;
  return Math.max(
    0.1,
    w[rating - 1] *
      Math.exp(w[8] * (11 - rating))
  );
}

/**
 * 计算初始难度（Rating -> Difficulty）
 */
function initialDifficulty(rating: Rating): number {
  const w = DEFAULT_PARAMETERS.w;
  const raw = w[7] - rating * w[8] + 1;
  return Math.max(1, Math.min(10, raw));
}

/**
 * 计算当前可检索性（Retrievability）
 * R = (1 + (D/S) * (t/S)^γ)^(-1)
 */
function retrievability(
  elapsedDays: number,
  stability: number,
  difficulty: number
): number {
  const w = DEFAULT_PARAMETERS.w;
  const gamma = w[26];
  const power = Math.max(0, Math.pow(elapsedDays / stability, gamma));
  const dFactor = difficulty / 10;
  return Math.pow(1 + dFactor * power, -1);
}

/**
 * 计算新稳定性（Stability After Review）
 * 根据当前状态和Rating更新稳定性
 */
function nextStability(
  currentStability: number,
  difficulty: number,
  rating: Rating,
  retrievability: number,
  elapsedDays: number
): number {
  const w = DEFAULT_PARAMETERS.w;

  // Hard penalty
  const hardPenalty = rating === 2 ? w[15] * (difficulty - 3) : 0;
  // Easy bonus
  const easyBonus = rating === 4 ? w[16] * (difficulty - 3) : 0;

  // 稳定性增长因子
  const growthFactor =
    currentStability * (Math.exp(w[17] * (11 - difficulty) * Math.pow(currentStability, -w[18]) *
      (Math.exp(w[19] * (1 - retrievability)) - 1) *
      (rating === 1 ? 0 : (rating === 2 ? w[20] : (rating === 3 ? w[21] : w[22]))) +
      hardPenalty + easyBonus));

  // 稳定性衰减（仅在Relearning状态）
  const decayFactor = 0;

  return Math.max(0.1, currentStability + growthFactor + decayFactor);
}

/**
 * 计算新难度（Difficulty After Review）
 */
function nextDifficulty(
  currentDifficulty: number,
  rating: Rating,
  retrievability: number
): number {
  const w = DEFAULT_PARAMETERS.w;
  const delta = -w[23] * (rating - 3);

  // 难度变化受可检索性影响
  const newD = currentDifficulty + delta * (10 - currentDifficulty) * 0.1;
  return Math.max(1, Math.min(10, newD));
}

/**
 * 计算下次复习间隔
 */
function nextInterval(
  currentStability: number,
  retrievability: number
): number {
  const w = DEFAULT_PARAMETERS.w;
  const newInterval = currentStability / w[24] *
    (Math.pow(DEFAULT_PARAMETERS.requestRetention, 1 / w[24]) - 1);

  // 应用间隔权重
  const scaledInterval = newInterval * (w[25] + (w[26] || 0));

  // 限制最大间隔
  return Math.min(
    DEFAULT_PARAMETERS.maximumInterval,
    Math.max(1, Math.round(scaledInterval))
  );
}

/**
 * 简化版：根据Rating决定下个状态
 */
function nextState(currentState: Card['state'], rating: Rating): Card['state'] {
  if (rating === 1) {
    // Again -> Learning/Relearning
    return currentState === 'New' || currentState === 'Learning' ? 'Learning' : 'Relearning';
  }
  if (rating === 2 || rating === 3) {
    // Hard/Good -> Review
    return 'Review';
  }
  // Easy -> Review (or graduate from Learning)
  return 'Review';
}

// ═══════════════════ 公开 API ═══════════════════

/**
 * 创建新卡片（首次学习）
 */
export function createCard(
  questionId: string,
  rating: Rating = 3
): Card {
  return {
    id: questionId,
    stability: initialStability(rating),
    difficulty: initialDifficulty(rating),
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    state: 'New',
    due: new Date(),
  };
}

/**
 * 复习卡片（根据Rating更新所有参数）
 */
export function reviewCard(
  card: Card,
  rating: Rating,
  reviewTime: Date = new Date()
): Card {
  // 计算当前可检索性
  const currentRetrievability = retrievability(
    card.elapsedDays,
    card.stability,
    card.difficulty
  );

  // 更新稳定性
  const newStability = nextStability(
    card.stability,
    card.difficulty,
    rating,
    currentRetrievability,
    card.elapsedDays
  );

  // 更新难度
  const newDifficulty = nextDifficulty(
    card.difficulty,
    rating,
    currentRetrievability
  );

  // 计算下次间隔
  const newInterval = nextInterval(newStability, DEFAULT_PARAMETERS.requestRetention);

  // 更新状态
  const newState = nextState(card.state, rating);

  // 计算下次复习时间
  const nextDue = new Date(reviewTime);
  nextDue.setDate(nextDue.getDate() + newInterval);

  return {
    ...card,
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays: 0,
    scheduledDays: newInterval,
    reps: card.reps + 1,
    state: newState,
    due: nextDue,
  };
}

/**
 * 计算卡片当前可检索性（用于显示复习进度）
 */
export function getRetrievability(card: Card, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - card.due.getTime() + card.scheduledDays * 86400000;
  const elapsedDays = Math.max(0, elapsedMs / 86400000);
  return retrievability(elapsedDays, card.stability, card.difficulty);
}

/**
 * 判断卡片是否需要复习
 */
export function needsReview(card: Card, now: Date = new Date()): boolean {
  return card.due <= now;
}

/**
 * 根据难度调整评分
 * 用户可以修正自评的难度
 */
export function adjustDifficulty(card: Card, rating: Rating): Card {
  return {
    ...card,
    difficulty: Math.max(1, Math.min(10, card.difficulty + (rating - 3) * 0.5)),
  };
}

/**
 * 获取卡片统计信息
 */
export function getCardStats(card: Card): {
  stability: number;
  difficulty: number;
  nextReview: Date;
  estimatedInterval: number;
  currentRetrievability: number;
} {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    nextReview: card.due,
    estimatedInterval: card.scheduledDays,
    currentRetrievability: getRetrievability(card),
  };
}

/**
 * 批量处理多张卡片（用于每日复习队列）
 */
export function processReviewQueue(
  cards: Card[],
  ratings: Rating[]
): { updatedCards: Card[]; stats: { total: number; averageStability: number; averageDifficulty: number } } {
  if (cards.length !== ratings.length) {
    throw new Error('Cards and ratings must have the same length');
  }

  const updatedCards = cards.map((card, i) => reviewCard(card, ratings[i]));

  const stats = {
    total: updatedCards.length,
    averageStability: updatedCards.reduce((sum, c) => sum + c.stability, 0) / updatedCards.length,
    averageDifficulty: updatedCards.reduce((sum, c) => sum + c.difficulty, 0) / updatedCards.length,
  };

  return { updatedCards, stats };
}
