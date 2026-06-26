/**
 * 切斯特牌 - 商店系统
 * 阶段 5：指定糖果购买 + 权重随机抽选 + 开局三选一 + 回收
 *
 * 定价规则：
 *   - 指定购买：按 candy.price（4-18）
 *   - 随机抽选：按平均价格 Math.round(sum/length)
 *   - 回收变卖：floor(price / 2)（向下取整）
 *
 * 开局三选一：仅 common + rare 池（最高稀有）
 * 随机抽选：按 RARITY_WEIGHT 50/30/15/4/1 递减权重
 */

import { getPoolForRound } from './candy-system.js';
import { CANDIES, RARITY_WEIGHT } from '../data/candies.js';

/**
 * 开局三选一池：仅 common + rare（开局最高选稀有）
 * @returns {Array} 糖果数组
 */
export function getStartingPool() {
  return CANDIES.filter(c => c.rarity === 'common' || c.rarity === 'rare');
}

/**
 * 计算糖果池的平均价格（四舍五入）
 * @param {Array} pool 糖果数组
 * @returns {number}
 */
export function getAveragePrice(pool) {
  if (!pool || pool.length === 0) return 0;
  const sum = pool.reduce((acc, c) => acc + c.price, 0);
  return Math.round(sum / pool.length);
}

/**
 * 获取商店货架（按当前关卡稀有度过滤的可购买列表）
 * @param {number} round 当前关卡
 * @returns {Array} 糖果数组
 */
export function getShopOfferings(round) {
  return getPoolForRound(round);
}

/**
 * 按稀有度权重递减抽选 1 张糖果（50/30/15/4/1）
 * @param {number} round 当前关卡
 * @returns 糖果对象
 */
export function drawWeightedCandy(round) {
  const pool = getPoolForRound(round);
  if (pool.length === 0) return null;
  const weighted = pool.map(c => ({ candy: c, weight: RARITY_WEIGHT[c.rarity] || 0 }));
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weighted) {
    r -= w.weight;
    if (r <= 0) return w.candy;
  }
  return weighted[weighted.length - 1].candy;
}

/**
 * 随机抽选 1 张糖果（向后兼容，内部调用 drawWeightedCandy）
 * @param {number} round 当前关卡
 * @returns 糖果对象
 */
export function drawRandomCandy(round) {
  return drawWeightedCandy(round);
}

/**
 * Fisher-Yates 洗牌（不修改原数组）
 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 三选一：从开局池（common+rare）抽取 count 张不重复糖果
 * @param {number} round 当前关卡（保留参数以兼容，实际使用 getStartingPool）
 * @param {number} count 数量（默认 3）
 * @returns {Array} 糖果数组
 */
export function getChoiceCandies(round, count = 3) {
  const pool = getStartingPool();
  const shuffled = shuffle(pool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * 检查玩家金币是否足够购买
 */
export function canAfford(coins, price) {
  return coins >= price;
}

/**
 * 计算随机抽选价格（基于商店货架均价 -2，最低 3）
 * 公式：max(3, floor(avgPrice - 2))
 */
export function getRandomDrawPrice(round) {
  const avg = getAveragePrice(getShopOfferings(round));
  return Math.max(3, Math.floor(avg - 2));
}

/**
 * 回收变卖价格（标价一半，向下取整）
 * @param {Object} candy 糖果对象
 * @returns {number}
 */
export function sellPrice(candy) {
  if (!candy || typeof candy.price !== 'number') return 0;
  return Math.floor(candy.price / 2);
}

