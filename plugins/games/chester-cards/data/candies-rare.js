/**
 * 切斯特牌 - 稀有糖果数据（3 颗）
 *
 * 效果类型说明：
 *   mult_color              全部同色（黑或红）时 ×value 倍率
 *   permanent_mult_hand     指定牌型出牌时永久 +value 倍率
 *   mult_4suits             5张牌含四种花色时 ×value 倍率
 */

export const CANDIES_RARE = [
  { id: 'gold-brick', name: '金砖糖', emoji: '🍫', rarity: 'rare',
    desc: '手牌全部同色（黑或红）时 ×4 倍率', price: 10,
    effect: { type: 'mult_color', value: 4 } },
  { id: 'toffee', name: '太妃糖', emoji: '🍯', rarity: 'rare',
    desc: '每打出一次两对，永久 +2 倍率', price: 12,
    effect: { type: 'permanent_mult_hand', handType: 'TWO_PAIR', value: 2 } },
  { id: 'jelly', name: '果冻糖', emoji: '🍓', rarity: 'rare',
    desc: '打出 5 张含四种花色时 ×5 倍率', price: 10,
    effect: { type: 'mult_4suits', value: 5 } }
];
