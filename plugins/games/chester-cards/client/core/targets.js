/**
 * 切斯特牌 - 无尽模式目标分计算
 * 三段式增长：
 *   阶段 1（1-20关）：线性递增，玩家快速成长
 *   阶段 2（21-80关）：指数增长，每关 +18%（Goal *= 1.18）
 *   阶段 3（80+关）：加速无尽，Goal(n) = Goal(80) × 1.25^(n-80)
 */

/** 阶段 1 预定义目标分（1-20关） */
const STAGE1_TARGETS = [
  500, 800, 1200, 1700, 2400, 3300, 4500, 6000, 8000, 10500,
  13500, 17000, 21000, 25500, 30500, 36000, 42000, 48500, 55500, 63000
];

const STAGE1_END = STAGE1_TARGETS[STAGE1_TARGETS.length - 1]; // 关 20 目标 = 63000
const STAGE2_GROWTH = 1.18;  // 阶段 2 每关增长 18%
const STAGE2_END_ROUND = 80; // 阶段 2 结束关卡
const STAGE3_GROWTH = 1.25;  // 阶段 3 每关增长 25%

/** 阶段 2 结束时（关 80）的目标分（取整，作为阶段 3 基准） */
const STAGE2_END = Math.floor(STAGE1_END * Math.pow(STAGE2_GROWTH, STAGE2_END_ROUND - 20));

/**
 * 计算指定关卡的目标分
 * @param {number} round - 关卡编号（从 1 开始）
 * @returns {number} 目标分（整数）
 */
export function getTarget(round) {
  if (round <= 0) return STAGE1_TARGETS[0];
  if (round <= 20) return STAGE1_TARGETS[round - 1];
  if (round <= 80) return Math.floor(STAGE1_END * Math.pow(STAGE2_GROWTH, round - 20));
  return Math.floor(STAGE2_END * Math.pow(STAGE3_GROWTH, round - 80));
}

/** 是否为无尽模式（无上限） */
export const ENDLESS = true;
