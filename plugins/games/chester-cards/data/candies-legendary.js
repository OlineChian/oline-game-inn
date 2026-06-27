/**
 * 切斯特牌 - 传奇糖果数据（2 颗）
 *
 * 效果类型说明：
 *   candy_king              弃掉指定点数牌（2/3/4），下一关倍率 ×该牌点数
 *   mult_chance             chance 概率 ×mult 倍率（复用已有类型）
 */

export const CANDIES_LEGENDARY = [
  { id: 'candy-king', name: '糖果王', emoji: '👑', rarity: 'legendary',
    desc: '每弃掉一张 2/3/4，下一关倍率 ×该牌点数', price: 35,
    effect: { type: 'candy_king', ranks: ['2', '3', '4'] } },
  { id: 'candy-queen', name: '糖果女王', emoji: '👑', rarity: 'legendary',
    desc: '30% 几率 ×8 倍率', price: 40,
    effect: { type: 'mult_chance', chance: 0.3, mult: 8 } }
];
