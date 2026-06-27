/**
 * 切斯特牌 - 牌型升级选项系统（阶段 4）
 *
 * 需求：
 *   1. 每局结束刷新 3 种牌型升级选项与价格（基于当前等级）
 *   2. 对子、双对等容易凑出的牌型几率较小（加权抽选）
 *   3. 极小概率（5%）出现组合升级：lv1→lv3，价格 = 升级到较高等级的价格
 *   4. 已达上限（lv10）的牌型不再出现
 *
 * 升级选项数据结构：
 *   {
 *     handKey: 'PAIR',
 *     fromLevel: 1,
 *     toLevel: 3,        // 组合升级时 toLevel = fromLevel + 2
 *     cost: 15,           // = upgradeCost({ [handKey]: toLevel - 1 }, handKey)
 *     isCombo: true       // 是否为组合升级
 *   }
 */

import { HAND_TYPES } from '../core/hand-evaluator.js';
import {
  getHandLevel, canUpgrade, upgradeCost, MAX_HAND_LEVEL
} from '../core/scoring.js';

/**
 * 牌型出现权重（容易凑出的牌型权重低，难凑的权重高）
 * 高牌/对子/两对：1（最常见，但实用度低且经常凑出）
 * 三条：2
 * 顺子/同花/葫芦：3
 * 四条：4
 * 同花顺/皇家同花顺/五条/同花葫芦/同花五条：5（最难凑，权重最高）
 */
const HAND_WEIGHTS = {
  HIGH_CARD: 1,
  PAIR: 1,
  TWO_PAIR: 1,
  THREE_KIND: 2,
  STRAIGHT: 3,
  FLUSH: 3,
  FULL_HOUSE: 3,
  FOUR_KIND: 4,
  STRAIGHT_FLUSH: 5,
  ROYAL_FLUSH: 5,
  FIVE_KIND: 5,
  FLUSH_HOUSE: 5,
  FLUSH_FIVE: 5
};

/** 组合升级出现概率（5%） */
const COMBO_UPGRADE_CHANCE = 0.05;

/** 组合升级跨越的级数（升 2 级：lv1→lv3） */
const COMBO_LEVEL_STEP = 2;

/** 阶段 5：每次商店提供的牌型升级选项数量（用户需求"牌型强化 ×2"） */
export const HAND_OFFERING_COUNT = 2;

/**
 * 加权随机抽取一个牌型 key（不重复，传入剩余池）
 * @param {Array} pool 剩余可选牌型 key 数组
 * @returns {string} 被选中的 handKey
 */
function pickWeightedHand(pool) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const weights = pool.map(k => HAND_WEIGHTS[k] || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * 构造单个升级选项
 * 5% 概率为组合升级（lv→lv+2，价格 = upgradeCost(lv+1)）
 * 普通升级为 lv→lv+1
 * @param {string} handKey 牌型 key
 * @param {Object} handLevels 当前牌型等级表
 * @returns {Object} 升级选项 { handKey, fromLevel, toLevel, cost, isCombo }
 */
export function buildOffering(handKey, handLevels) {
  const fromLevel = getHandLevel(handLevels, handKey);
  // 组合升级条件：5% 概率且 fromLevel + 2 不超过上限
  const canCombo = (fromLevel + COMBO_LEVEL_STEP) <= MAX_HAND_LEVEL;
  const isCombo = canCombo && Math.random() < COMBO_UPGRADE_CHANCE;
  const toLevel = isCombo ? fromLevel + COMBO_LEVEL_STEP : fromLevel + 1;
  // 价格 = 升级到 toLevel 的价格 = upgradeCost({ [handKey]: toLevel - 1 }, handKey)
  const tempLevels = { [handKey]: toLevel - 1 };
  const cost = upgradeCost(tempLevels, handKey);
  // 组合升级原价 = 逐级升级总和（用于 UI 划线显示，体现超值）
  let originalCost = null;
  if (isCombo) {
    let sum = 0;
    for (let lv = fromLevel; lv < toLevel; lv++) {
      sum += upgradeCost({ [handKey]: lv }, handKey);
    }
    originalCost = sum;
  }
  return { handKey, fromLevel, toLevel, cost, isCombo, originalCost };
}

/**
 * 生成 3 种牌型升级选项
 * - 过滤已达上限（lv10）的牌型
 * - 加权随机抽取 3 个不重复牌型
 * - 每个选项独立判断是否为组合升级
 * @param {number} round 当前关卡（保留参数，未来可基于关卡调整权重）
 * @param {Object} handLevels 牌型等级表
 * @returns {Array} 升级选项数组（长度可能小于 3，若可升级牌型不足）
 */
export function getHandUpgradeOfferings(round, handLevels) {
  // 过滤可升级的牌型（未达上限）
  const candidates = Object.keys(HAND_TYPES).filter(k => canUpgrade(handLevels, k));
  if (candidates.length === 0) return [];

  const offerings = [];
  const pool = [...candidates];
  const targetCount = Math.min(HAND_OFFERING_COUNT, pool.length);
  for (let i = 0; i < targetCount; i++) {
    const handKey = pickWeightedHand(pool);
    if (!handKey) break;
    // 从池中移除已选
    const idx = pool.indexOf(handKey);
    if (idx >= 0) pool.splice(idx, 1);
    offerings.push(buildOffering(handKey, handLevels));
  }
  return offerings;
}

/**
 * 判断升级选项在当前等级表下是否仍然有效
 * （打开商店时等级为 1，购买后等级提升，该选项可能已不再可升级）
 * 用于 UI 禁用判断
 * @param {Object} offering 升级选项
 * @param {Object} handLevels 当前牌型等级表
 * @returns {boolean} 是否仍可购买
 */
export function isOfferingValid(offering, handLevels) {
  const currentLevel = getHandLevel(handLevels, offering.handKey);
  // 当前等级必须等于选项的 fromLevel（未升级过）
  // 且目标等级不超过上限
  return currentLevel === offering.fromLevel
    && offering.toLevel <= MAX_HAND_LEVEL;
}
