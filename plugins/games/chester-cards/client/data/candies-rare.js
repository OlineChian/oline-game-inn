/**
 * 切斯特牌 - 稀有糖果数据
 *
 * 效果类型说明：
 *   mult_color              全部同色（黑或红）时 ×value 倍率
 *   hand_modifier            牌型识别修改（short_hand: 顺子/同花仅需4张）
 *   permanent_mult_play     出牌 +perPlay 倍率 / 弃牌 +perDiscard 倍率（永久，带上限）
 *   mult_4suits             4张牌含四种花色时 ×value 倍率
 *   per_parity              每张奇/偶点数牌给予 chips/mult
 *
 * 扩展字段：
 *   tag             分类标签（倍率型/牌型流/爆发型/运营型/成长型/弃牌流/收藏型）
 *   rating          推荐指数 1-5（综合考虑触发率、构筑性、前后期、永久性、联动）
 *   balanceChange   V1.1 平衡调整标记（buff/nerf/rework/new），未修改则省略
 */

export const CANDIES_RARE = [
  { id: 'gold-brick', name: '金砖糖', emoji: '🍫', rarity: 'rare',
    desc: '手牌全部同色（黑或红）时 ×4 倍率', price: 10,
    effect: { type: 'mult_color', value: 4 },
    tag: '收藏型', rating: 3 },
  { id: 'rainbow-donut', name: '彩虹甜甜圈', emoji: '🍩', rarity: 'rare',
    desc: '顺子和同花只需 4 张牌即可组成（同花顺仍需 5 张）', price: 12,
    effect: { type: 'hand_modifier', modifier: 'short_hand' },
    tag: '运营型', rating: 4 },
  { id: 'milk-candy', name: '牛奶糖', emoji: '🍬', rarity: 'rare',
    desc: '每出牌 +1 倍率（永久，上限 80）；每弃牌 -1 倍率（永久）', price: 10,
    effect: { type: 'permanent_mult_play', perPlay: 1, perDiscard: -1, maxPermMult: 80 },
    tag: '成长型', rating: 4, balanceChange: 'nerf' },
  { id: 'apple', name: '苹果糖', emoji: '🍎', rarity: 'rare',
    desc: '每张偶数点数牌给予 +2 倍率', price: 8,
    effect: { type: 'per_parity', parity: 'even', mult: 2 },
    tag: '倍率型', rating: 3 },
  { id: 'jelly', name: '果冻糖', emoji: '🍓', rarity: 'rare',
    desc: '打出 4 张不同花色时 ×5 倍率', price: 10,
    effect: { type: 'mult_4suits', value: 5 },
    tag: '收藏型', rating: 3 }
];
