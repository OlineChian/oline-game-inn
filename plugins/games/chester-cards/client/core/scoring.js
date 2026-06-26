/**
 * 切斯特牌 - 得分计算
 * 公式：得分 = (基础分 + 牌面分) × 倍率
 * Balatro 风格，基础分与牌面分都会被倍率放大
 * 牌型升级：每级 +plusChips 筹码 +plusMult 倍率（Planet 牌机制）
 */

import { evaluateHand } from './hand-evaluator.js';
import { cardChip } from './deck.js';

/** 各牌型基础筹码、倍率与每级增量（Balatro 完整规则） */
export const HAND_SCORES = {
  HIGH_CARD:      { base: 5,   mult: 1,  plusChips: 10, plusMult: 1 },
  PAIR:           { base: 10,  mult: 2,  plusChips: 15, plusMult: 1 },
  TWO_PAIR:       { base: 20,  mult: 2,  plusChips: 20, plusMult: 1 },
  THREE_KIND:     { base: 30,  mult: 3,  plusChips: 20, plusMult: 2 },
  STRAIGHT:       { base: 30,  mult: 4,  plusChips: 30, plusMult: 3 },
  FLUSH:          { base: 35,  mult: 4,  plusChips: 15, plusMult: 2 },
  FULL_HOUSE:     { base: 40,  mult: 4,  plusChips: 25, plusMult: 2 },
  FOUR_KIND:      { base: 60,  mult: 7,  plusChips: 30, plusMult: 3 },
  STRAIGHT_FLUSH: { base: 100, mult: 8,  plusChips: 40, plusMult: 4 },
  ROYAL_FLUSH:    { base: 100, mult: 8,  plusChips: 40, plusMult: 4 },
  FIVE_KIND:      { base: 120, mult: 12, plusChips: 35, plusMult: 3 },
  FLUSH_HOUSE:    { base: 140, mult: 14, plusChips: 40, plusMult: 4 },
  FLUSH_FIVE:     { base: 160, mult: 16, plusChips: 50, plusMult: 3 }
};

/** 获取牌型当前等级（默认 1） */
export function getHandLevel(handLevels, handKey) {
  return (handLevels && handLevels[handKey]) || 1;
}

/** 升级牌型（返回新等级表，不可变更新） */
export function upgradeHandType(handLevels, handKey) {
  const level = getHandLevel(handLevels, handKey);
  return { ...handLevels, [handKey]: level + 1 };
}

/** 升级牌型所需金币（按等级递增：基础 5 + 当前等级 × 3） */
export function upgradeCost(handLevels, handKey) {
  const level = getHandLevel(handLevels, handKey);
  return 5 + level * 3;
}

/**
 * 计算一手牌的得分（应用牌型升级等级）
 * @param {Array} cards 出牌（1-5 张）
 * @param {Object} handLevels 牌型等级表 { HAND_KEY: level }，默认空（全部 1 级）
 * @returns {Object} { score, handType, base, mult, chips, level, formula }
 */
export function scoreHand(cards, handLevels = {}) {
  if (!cards || cards.length === 0) {
    return { score: 0, handType: null, base: 0, mult: 0, chips: 0, level: 0, formula: '' };
  }

  const handType = evaluateHand(cards);
  const config = HAND_SCORES[handType.key];
  const level = getHandLevel(handLevels, handType.key);
  const actualBase = config.base + config.plusChips * (level - 1);
  const actualMult = config.mult + config.plusMult * (level - 1);
  const chips = cards.reduce((sum, c) => sum + cardChip(c), 0);
  const total = (actualBase + chips) * actualMult;
  const levelTag = level > 1 ? ` Lv.${level}` : '';

  return {
    score: total,
    handType,
    base: actualBase,
    mult: actualMult,
    chips,
    level,
    formula: `(${actualBase} + ${chips}) × ${actualMult}${levelTag} = ${total}`
  };
}
