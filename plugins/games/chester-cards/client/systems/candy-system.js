/**
 * 切斯特牌 - 糖果系统
 * 处理糖果效果应用与商店辅助逻辑
 *
 * 效果应用顺序：
 *   1. 计算 base / mult / chips（原始 scoreHand 结果）
 *   2. 各糖果通过 applyEffect 返回增量：
 *      - baseAdd 累加 → newBase
 *      - chipsAdd 累加 → newChips
 *      - multAdd 累加 → newMult
 *      - multMul 乘法叠加 → newMult
 *      - scoreBonus 累加 → scoreBonus
 *   3. 最终得分 = (newBase + newChips) × newMult + scoreBonus
 *   4. 时机钩子效果（永久状态/糖果工厂等）在 candy-hooks.js 中处理
 */

import { CANDIES, RARITY_UNLOCK_ROUND } from '../data/candies.js';
import { getAvailableRarities } from '../data/wave-config.js';
import { applyEffect } from './candy-effects.js';

/**
 * 出牌时应用糖果效果到得分
 * @param {Object} baseResult scoreHand 返回的原始结果
 * @param {Array} candies 玩家拥有的糖果
 * @param {Object} context 上下文：
 *   playedCards: 出牌列表
 *   deckUsed: 牌库已用张数
 *   isLastPlayOfRound: 是否本关最后一次出牌
 *   prevPlayHandType: 本关上一次出牌的牌型 key
 *   maxCandies: 最大槽位
 *   candyCount: 当前糖果数
 * @returns {Object} 含 finalScore / triggered 列表
 */
export function applyCandiesToScore(baseResult, candies, context = {}) {
  return applyCandiesInternal(baseResult, candies, context, false);
}

/**
 * 实时预览：选牌时计算当前牌型与分数（应用糖果效果）
 * 与 applyCandiesToScore 的区别：mult_chance 类型不实际掷骰子，
 * 仅标记为「机会加成」，避免预览分数跳动
 */
export function previewCandiesToScore(baseResult, candies, context = {}) {
  return applyCandiesInternal(baseResult, candies, context, true);
}

/** 内部共享实现：应用糖果效果到得分 */
function applyCandiesInternal(baseResult, candies, context, isPreview) {
  if (!candies || candies.length === 0) {
    return { ...baseResult, triggered: [], hasChance: false };
  }

  const ctx = { ...context, isPreview };
  let { base, mult, chips, handType } = baseResult;
  let newBase = base;
  let newChips = chips;
  let newMult = mult;
  let scoreBonus = 0;
  let hasChance = false;
  const triggered = [];

  for (const candy of candies) {
    const r = applyEffect(candy.effect, baseResult, candy, ctx);
    if (r.baseAdd) newBase += r.baseAdd;
    if (r.chipsAdd) newChips += r.chipsAdd;
    if (r.multAdd) newMult += r.multAdd;
    if (r.multMul) newMult *= r.multMul;
    if (r.scoreBonus) scoreBonus += r.scoreBonus;
    if (r.triggered) {
      triggered.push(r.triggered);
      if (r.triggered.isChance) hasChance = true;
    }
  }

  const finalScore = (newBase + newChips) * newMult + scoreBonus;
  const bonusPart = scoreBonus ? ` + ${scoreBonus}` : '';
  return {
    ...baseResult,
    base: newBase,
    chips: newChips,
    mult: newMult,
    score: finalScore,
    triggered,
    hasChance,
    formula: `(${newBase} + ${newChips}) × ${newMult}${bonusPart} = ${finalScore}`
  };
}

/**
 * 回合开始时应用糖果效果（金币等持续性效果）
 * @param {Array} candies 玩家拥有的糖果
 * @returns {Object} { coinBonus, triggered }
 */
export function applyCandiesPerRound(candies) {
  let coinBonus = 0;
  const triggered = [];
  if (!candies) return { coinBonus, triggered };

  for (const candy of candies) {
    if (candy.effect.type === 'coin_per_round') {
      coinBonus += candy.effect.value;
      triggered.push({ candy, msg: `+${candy.effect.value} 金币` });
    }
  }
  return { coinBonus, triggered };
}

/**
 * 获取当前关卡的可用糖果池（基于 Wave 系统的稀有度过滤）
 * Wave 1（1-10关）：common/rare/epic
 * Wave 2（11-30关）：common/rare/epic/mythic
 * Wave 3（31+关）：全部稀有度
 */
export function getPoolForRound(round) {
  const rarities = getAvailableRarities(round);
  return CANDIES.filter(c => rarities.includes(c.rarity));
}

/** 从池中随机抽取 1 张糖果 */
export function getRandomCandy(round) {
  const pool = getPoolForRound(round);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 检查是否还能添加糖果 */
export function canAddCandy(candies, maxCandies) {
  return candies.length < maxCandies;
}

/**
 * 检测糖果列表中是否有指定 hand_modifier（如彩虹甜甜圈的 short_hand）
 * @param {Array} candies 玩家拥有的糖果
 * @param {string} modifier 要检测的 modifier 名称
 * @returns {boolean}
 */
export function hasHandModifier(candies, modifier) {
  return candies.some(c => c.effect.type === 'hand_modifier' && c.effect.modifier === modifier);
}
