/**
 * 切斯特牌 - 特殊商品系统（阶段 6）
 *
 * 提供特殊商品的生成与应用效果：
 *   - getSpecialItemOffering(round)：随机返回 1 个特殊商品
 *   - applySpecialItem(item, state, config)：应用特殊商品效果
 *
 * 效果应用：
 *   random_candy    → 随机获得指定稀有度糖果（需有空槽）
 *   coin_gain       → state.coins += value
 *   recycle_candy   → 原价回收最早拥有的糖果（state.candies[0]）
 */

import { SPECIAL_ITEMS } from '../data/special-items.js';
import { CANDIES } from '../data/candies.js';
import { canAddCandy } from './candy-system.js';

/**
 * 随机抽取 1 个特殊商品（"特殊商品 ×1"）
 * 20% 概率本回合不出现特殊商品（返回 null）
 * @param {number} round 当前关卡（保留参数，未来可基于关卡调整）
 * @returns {Object|null} 特殊商品对象，或 null 表示本回合无特殊商品
 */
export function getSpecialItemOffering(round) {
  if (Math.random() < 0.2) return null;
  const idx = Math.floor(Math.random() * SPECIAL_ITEMS.length);
  return SPECIAL_ITEMS[idx];
}

/**
 * 应用特殊商品效果
 * @param {Object} item 特殊商品对象
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 * @returns {Object} { success, message, candy } 应用结果
 */
export function applySpecialItem(item, state, config) {
  const effect = item.effect;
  if (!effect) return { success: false, message: '无效的特殊商品' };

  switch (effect.type) {
    case 'random_candy': {
      // 获得指定稀有度的随机糖果
      if (!canAddCandy(state.candies, config.maxCandies)) {
        return { success: false, message: '糖果槽位已满，无法获得新糖果' };
      }
      const candidates = CANDIES.filter(c => c.rarity === effect.rarity);
      if (candidates.length === 0) {
        return { success: false, message: `没有 ${effect.rarity} 稀有度的糖果` };
      }
      const candy = candidates[Math.floor(Math.random() * candidates.length)];
      state.candies.push(candy);
      return {
        success: true,
        message: `获得 ${candy.name}（${candy.rarity}）`,
        candy
      };
    }

    case 'coin_gain': {
      // 立即获得金币
      state.coins += effect.value;
      return {
        success: true,
        message: `获得 ${effect.value} 金币`
      };
    }

    case 'recycle_candy': {
      // 原价回收最早拥有的糖果
      if (state.candies.length === 0) {
        return { success: false, message: '没有可回收的糖果' };
      }
      const target = state.candies[0];
      const refund = target.price;  // 原价回收（非半价）
      state.candies.shift();
      state.coins += refund;
      return {
        success: true,
        message: `回收 ${target.name}，获得 ${refund} 金币（原价）`,
        candy: target
      };
    }

    default:
      return { success: false, message: `未知效果类型：${effect.type}` };
  }
}

/**
 * 检查特殊商品是否可购买（前置条件检查）
 * - random_candy 需要空槽
 * - recycle_candy 需要至少 1 颗糖果
 * @param {Object} item 特殊商品
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 * @returns {boolean}
 */
export function canBuySpecialItem(item, state, config) {
  const effect = item.effect;
  if (!effect) return false;
  if (effect.type === 'random_candy') {
    return canAddCandy(state.candies, config.maxCandies);
  }
  if (effect.type === 'recycle_candy') {
    return state.candies.length > 0;
  }
  return true;
}
