/**
 * 切斯特牌 - 牌库段位（Deck Tiers）
 *
 * 以 wave 50/100/200/300 为换副节点，每段启用更多副牌：
 *   tier 1（关 1-49）：1 副，出牌 4→7，弃牌 2→3
 *   tier 2（关 50-99）：2 副，出牌 7→14，弃牌 3→6
 *   tier 3（关 100-199）：3 副，出牌 14→21，弃牌 6→9
 *   tier 4（关 200-299）：4 副，出牌 21→28，弃牌 9→12
 *   tier 5+（关 300+）：5+ 副，每 100 关 +1 副，次数 +7/+3
 *
 * 每段内部渐进增长（"陆续增加"），在 growthStart 之后按 step 间隔 +1。
 *
 * 与 wave-config.js 的稀有度 WAVE_CONFIG 是两个独立维度，互不影响。
 */

const DECK_SIZE = 52;

const TIERS = [
  { tier: 1, minRound: 1,   maxRound: 49,  deckCount: 1, growthStart: 11,  basePlay: 4,  maxPlay: 7,  baseDiscard: 2,  maxDiscard: 3 },
  { tier: 2, minRound: 50,  maxRound: 99,  deckCount: 2, growthStart: 51,  basePlay: 7,  maxPlay: 14, baseDiscard: 3,  maxDiscard: 6 },
  { tier: 3, minRound: 100, maxRound: 199, deckCount: 3, growthStart: 101, basePlay: 14, maxPlay: 21, baseDiscard: 6,  maxDiscard: 9 },
  { tier: 4, minRound: 200, maxRound: 299, deckCount: 4, growthStart: 201, basePlay: 21, maxPlay: 28, baseDiscard: 9,  maxDiscard: 12 }
];

/**
 * 获取指定关卡的副数
 * @param {number} round
 * @returns {number} 1/2/3/4/5+...
 */
export function getDeckCount(round) {
  if (round < 50) return 1;
  if (round < 100) return 2;
  if (round < 200) return 3;
  if (round < 300) return 4;
  return 5 + Math.floor((round - 300) / 100);
}

/**
 * 判断指定关卡是否为换副节点
 * 换副节点：50, 100, 200, 300, 400, 500...
 * @param {number} round
 * @returns {boolean}
 */
export function isDeckUpgradeRound(round) {
  if (round === 50) return true;
  if (round >= 100 && round % 100 === 0) return true;
  return false;
}

/**
 * 获取指定关卡的 tier 配置
 * tier 5+ 动态生成
 * @param {number} round
 * @returns {Object} tier 配置对象
 */
export function getTier(round) {
  for (const t of TIERS) {
    if (round >= t.minRound && round <= t.maxRound) return t;
  }
  const tierIndex = 5 + Math.floor((round - 300) / 100);
  const minRound = 300 + (tierIndex - 5) * 100;
  const maxRound = minRound + 99;
  return {
    tier: tierIndex,
    minRound,
    maxRound,
    deckCount: tierIndex,
    growthStart: minRound + 1,
    basePlay: 7 * (tierIndex - 1),
    maxPlay: 7 * tierIndex,
    baseDiscard: 3 * (tierIndex - 1),
    maxDiscard: 3 * tierIndex
  };
}

/**
 * 通用渐进增长计算
 * - round < growthStart: 返回 base
 * - round >= growthStart: 按 step 间隔 +1，封顶 max
 * - step = floor((maxRound - growthStart + 1) / (max - base))
 * @param {number} round
 * @param {Object} tier tier 配置
 * @param {string} type 'play' | 'discard'
 * @returns {number}
 */
function getRoundLimit(round, tier, type) {
  const base = type === 'play' ? tier.basePlay : tier.baseDiscard;
  const max = type === 'play' ? tier.maxPlay : tier.maxDiscard;
  if (round < tier.growthStart) return base;
  const span = tier.maxRound - tier.growthStart + 1;
  const range = max - base;
  if (range <= 0) return base;
  const step = Math.max(1, Math.floor(span / range));
  const increments = 1 + Math.floor((round - tier.growthStart) / step);
  return Math.min(max, base + increments);
}

/**
 * 获取指定关卡的出牌次数上限（渐进增长）
 * @param {number} round
 * @returns {number}
 */
export function getPlaysForRound(round) {
  const tier = getTier(round);
  return getRoundLimit(round, tier, 'play');
}

/**
 * 获取指定关卡的弃牌次数上限（渐进增长）
 * @param {number} round
 * @returns {number}
 */
export function getDiscardsForRound(round) {
  const tier = getTier(round);
  return getRoundLimit(round, tier, 'discard');
}

/**
 * 获取指定关卡的牌库总张数（= 52 × 副数）
 * @param {number} round
 * @returns {number}
 */
export function getDeckTotalCards(round) {
  return DECK_SIZE * getDeckCount(round);
}
