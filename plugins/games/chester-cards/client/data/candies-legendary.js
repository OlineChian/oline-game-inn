/**
 * 切斯特牌 - 传奇糖果数据（2 颗）
 *
 * 效果类型说明：
 *   candy_king              弃掉指定点数牌（2/3/4），下一次出牌获得倍率 ×该牌点数
 *   mult_chance             chance 概率 ×mult 倍率（复用已有类型）
 *
 * 扩展字段：
 *   tag             分类标签（倍率型/牌型流/爆发型/运营型/成长型/弃牌流/收藏型）
 *   rating          推荐指数 1-5（综合考虑触发率、构筑性、前后期、永久性、联动）
 *   balanceChange   V1.1 平衡调整标记（buff/nerf/rework/new），未修改则省略
 *
 * 乘法价值说明：
 *   candy-queen 为 multMul（×6），平均乘子 ×2.0。传奇定位为"稀有且强力"，
 *   非必然最强；其实战价值在于 20% 触发时的爆发性翻倍，改变单局结果。
 */

export const CANDIES_LEGENDARY = [
  { id: 'candy-king', name: '糖果王', emoji: '👑', rarity: 'legendary',
    desc: '弃牌后，下一次出牌获得倍率 ×该牌点数（2/3/4）', price: 35,
    effect: { type: 'candy_king', ranks: ['2', '3', '4'] },
    tag: '弃牌流', rating: 3 },
  { id: 'candy-queen', name: '糖果女王', emoji: '👑', rarity: 'legendary',
    desc: '20% 几率 ×6 倍率', price: 40,
    effect: { type: 'mult_chance', chance: 0.2, mult: 6 },
    tag: '爆发型', rating: 4 }
];
