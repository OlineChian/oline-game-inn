/**
 * 切斯特牌 - 牌型识别模块
 * 识别 13 种扑克牌型（按强度从低到高）
 * 含 Balatro 扩展牌型：皇家同花顺、五条、同花葫芦、同花五条
 */

/** 牌型枚举（tier 越大越强） */
export const HAND_TYPES = {
  HIGH_CARD:      { key: 'HIGH_CARD',      name: '高牌',         tier: 1 },
  PAIR:           { key: 'PAIR',           name: '对子',         tier: 2 },
  TWO_PAIR:       { key: 'TWO_PAIR',       name: '两对',         tier: 3 },
  THREE_KIND:     { key: 'THREE_KIND',     name: '三条',         tier: 4 },
  STRAIGHT:       { key: 'STRAIGHT',       name: '顺子',         tier: 5 },
  FLUSH:          { key: 'FLUSH',          name: '同花',         tier: 6 },
  FULL_HOUSE:     { key: 'FULL_HOUSE',     name: '葫芦',         tier: 7 },
  FOUR_KIND:      { key: 'FOUR_KIND',      name: '四条',         tier: 8 },
  STRAIGHT_FLUSH: { key: 'STRAIGHT_FLUSH', name: '同花顺',       tier: 9 },
  ROYAL_FLUSH:    { key: 'ROYAL_FLUSH',    name: '皇家同花顺',   tier: 10 },
  FIVE_KIND:      { key: 'FIVE_KIND',      name: '五条',         tier: 11 },
  FLUSH_HOUSE:    { key: 'FLUSH_HOUSE',    name: '同花葫芦',     tier: 12 },
  FLUSH_FIVE:     { key: 'FLUSH_FIVE',     name: '同花五条',     tier: 13 }
};

/** 统计每个点数出现次数 */
function rankCounts(cards) {
  const counts = {};
  for (const c of cards) {
    counts[c.value] = (counts[c.value] || 0) + 1;
  }
  return counts;
}

/** 同花检测：5 张同花色 */
function isFlush(cards) {
  if (cards.length < 5) return false;
  const suit = cards[0].suit;
  return cards.every(c => c.suit === suit);
}

/** 顺子检测：5 张连续点数（A 可作 1 或 14） */
function isStraight(cards) {
  if (cards.length < 5) return false;
  const values = [...new Set(cards.map(c => c.value))].sort((a, b) => a - b);
  if (values.length < 5) return false;

  // 普通连续顺子
  for (let i = 0; i <= values.length - 5; i++) {
    let ok = true;
    for (let j = 0; j < 4; j++) {
      if (values[i + j + 1] !== values[i + j] + 1) { ok = false; break; }
    }
    if (ok) return true;
  }
  // A-2-3-4-5（A 当 1）
  if (values.includes(14) && values.includes(2) && values.includes(3)
      && values.includes(4) && values.includes(5)) {
    return true;
  }
  return false;
}

/** 皇家检测：10-J-Q-K-A（value: 10,11,12,13,14） */
function isRoyal(cards) {
  if (cards.length < 5) return false;
  const values = cards.map(c => c.value).sort((a, b) => a - b);
  return values.length === 5
    && values[0] === 10 && values[1] === 11 && values[2] === 12
    && values[3] === 13 && values[4] === 14;
}

/** 同花五条检测：5 张完全相同（点数与花色都相同，需改造牌组） */
function isFlushFive(cards) {
  if (cards.length < 5) return false;
  const first = cards[0];
  return cards.every(c => c.value === first.value && c.suit === first.suit);
}

/**
 * 识别牌型（按强度从高到低检测）
 * @param {Array} cards 出牌（1-5 张）
 * @returns 牌型对象，空输入返回 null
 */
export function evaluateHand(cards) {
  if (!cards || cards.length === 0) return null;

  const counts = rankCounts(cards);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const flush = isFlush(cards);
  const straight = isStraight(cards);

  // 1. 同花五条：5 张完全相同（最强）
  if (isFlushFive(cards)) return HAND_TYPES.FLUSH_FIVE;
  // 2. 同花葫芦：3+2 且全同花色（需改造牌组）
  if (flush && countValues[0] === 3 && countValues[1] === 2) return HAND_TYPES.FLUSH_HOUSE;
  // 3. 五条：5 张同点数（需改造牌组）
  if (countValues[0] === 5) return HAND_TYPES.FIVE_KIND;
  // 4. 皇家同花顺：10-J-Q-K-A 同花色
  if (flush && straight && isRoyal(cards)) return HAND_TYPES.ROYAL_FLUSH;
  // 5. 同花顺：连续点数 + 同花色（非皇家）
  if (straight && flush) return HAND_TYPES.STRAIGHT_FLUSH;
  // 6. 四条
  if (countValues[0] === 4) return HAND_TYPES.FOUR_KIND;
  // 7. 葫芦
  if (countValues[0] === 3 && countValues[1] === 2) return HAND_TYPES.FULL_HOUSE;
  // 8. 同花
  if (flush) return HAND_TYPES.FLUSH;
  // 9. 顺子
  if (straight) return HAND_TYPES.STRAIGHT;
  // 10. 三条
  if (countValues[0] === 3) return HAND_TYPES.THREE_KIND;
  // 11. 两对
  if (countValues[0] === 2 && countValues[1] === 2) return HAND_TYPES.TWO_PAIR;
  // 12. 对子
  if (countValues[0] === 2) return HAND_TYPES.PAIR;
  // 13. 高牌
  return HAND_TYPES.HIGH_CARD;
}
