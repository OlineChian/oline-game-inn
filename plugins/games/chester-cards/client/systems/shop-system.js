/**
 * 切斯特牌 - 商店系统
 * 阶段 5：指定糖果购买 + 权重随机抽选 + 开局三选一 + 回收
 *
 * 定价规则：
 *   - 指定购买：按 candy.price（4-18）
 *   - 随机抽选：按平均价格 Math.round(sum/length)
 *   - 回收变卖：floor(price / 2)（向下取整）
 *
 * 开局三选一：仅 common + rare 池（开局最高选稀有）
 * 随机抽选：按 Wave 系统分段权重（1-10关 70/25/5，11-30关 45/35/15/5，31+关 30/35/20/10/5）
 */

import { getPoolForRound } from './candy-system.js';
import { CANDIES } from '../data/candies.js';

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
 * 阶段 5：糖果货架从"全部可购买"改为"随机抽 N 个"
 * @param {number} round 当前关卡
 * @returns {Array} 糖果数组
 */
export function getShopOfferings(round) {
  return getPoolForRound(round);
}

/**
 * 阶段 5：从糖果货架中随机抽取指定数量的不重复糖果
 * 商店货架显示固定数量（默认 3 个），刷新时重新抽取
 * @param {number} round 当前关卡
 * @param {number} count 数量（默认 3，对应"糖果 ×3"）
 * @returns {Array} 糖果数组
 */
export function getCandyShopOfferings(round, count = 3) {
  const pool = getShopOfferings(round);
  if (pool.length === 0) return [];
  const shuffled = shuffle(pool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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
 * 回收变卖价格（标价一半，向下取整）
 * @param {Object} candy 糖果对象
 * @returns {number}
 */
export function sellPrice(candy) {
  if (!candy || typeof candy.price !== 'number') return 0;
  return Math.floor(candy.price / 2);
}

