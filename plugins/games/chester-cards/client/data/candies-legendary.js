/**
 * 切斯特牌 - 传奇糖果数据（2 颗）
 *
 * 效果类型说明：
 *   candy_king              弃掉指定点数牌（2/3/4），下一次出牌获得倍率 ×该牌点数
 *   mult_chance             chance 概率 ×mult 倍率（复用已有类型）
 */

export const CANDIES_LEGENDARY = [
  { id: 'candy-king', name: '糖果王', emoji: '👑', rarity: 'legendary',
    desc: '弃牌后，下一次出牌获得倍率 ×该牌点数（2/3/4）', price: 35,
    effect: { type: 'candy_king', ranks: ['2', '3', '4'] } },
  { id: 'candy-queen', name: '糖果女王', emoji: '👑', rarity: 'legendary',
    desc: '20% 几率 ×6 倍率', price: 40,
    effect: { type: 'mult_chance', chance: 0.2, mult: 6 } }
];
