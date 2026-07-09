/**
 * 切斯特牌 - 稀有糖果数据
 *
 * 效果类型说明：
 *   mult_color              全部同色（黑或红）时 ×value 倍率
 *   hand_modifier            牌型识别修改（short_hand: 顺子/同花仅需4张）
 *   permanent_mult_play     出牌 +perPlay 倍率 / 弃牌 +perDiscard 倍率（永久，带上限）
 *   mult_4suits             4张牌含四种花色时 ×value 倍率
 *   per_parity              每张奇/偶点数牌给予 chips/mult
 */

export const CANDIES_RARE = [
  { id: 'gold-brick', name: '金砖糖', emoji: '🍫', rarity: 'rare',
    desc: '手牌全部同色（黑或红）时 ×4 倍率', price: 10,
    effect: { type: 'mult_color', value: 4 } },
  { id: 'rainbow-donut', name: '彩虹甜甜圈', emoji: '🍩', rarity: 'rare',
    desc: '顺子和同花只需 4 张牌即可组成（同花顺仍需 5 张）', price: 12,
    effect: { type: 'hand_modifier', modifier: 'short_hand' } },
  { id: 'milk-candy', name: '牛奶糖', emoji: '🍬', rarity: 'rare',
    desc: '每出牌 +1 倍率（永久，上限 80）；每弃牌 -1 倍率（永久）', price: 6,
    effect: { type: 'permanent_mult_play', perPlay: 1, perDiscard: -1, maxPermMult: 80 } },
  { id: 'apple', name: '苹果糖', emoji: '🍎', rarity: 'rare',
    desc: '每张偶数点数牌给予 +2 倍率', price: 8,
    effect: { type: 'per_parity', parity: 'even', mult: 2 } },
  { id: 'jelly', name: '果冻糖', emoji: '🍓', rarity: 'rare',
    desc: '打出 4 张不同花色时 ×5 倍率', price: 10,
    effect: { type: 'mult_4suits', value: 5 } }
];
