/**
 * 切斯特牌 - 史诗糖果数据
 *
 * 效果类型说明：
 *   mult_empty_slot         每个空糖果槽位 ×value 倍率
 *   mult_same_hand          本关再次打出上一关相同牌型时 ×value 倍率
 *   mult_last_play          本关最后一次出牌时 ×value 倍率
 *   permanent_chips_hand    指定牌型出牌时永久 +value 筹码（带上限）
 *   permanent_mult_hand     指定牌型出牌时永久 +value 倍率（带上限）
 *   per_rank                每张指定点数牌给予 chips/mult（加法叠加）
 */

export const CANDIES_EPIC = [
  { id: 'rainbow', name: '七彩糖', emoji: '🌈', rarity: 'epic',
    desc: '每个空糖果槽位 ×2 倍率', price: 15,
    effect: { type: 'mult_empty_slot', value: 2 } },
  { id: 'gold-choco', name: '金砖巧克力', emoji: '🍫', rarity: 'epic',
    desc: '本关连续两次打出相同牌型时 ×3 倍率', price: 20,
    effect: { type: 'mult_same_hand', value: 3 } },
  { id: 'infinite', name: '无限糖', emoji: '🍬', rarity: 'epic',
    desc: '本关最后一次出牌时 ×3 倍率', price: 15,
    effect: { type: 'mult_last_play', value: 3 } },
  { id: 'hazel-choco', name: '榛果巧克力', emoji: '🍫', rarity: 'epic',
    desc: '顺子出牌时永久 +15 筹码（上限 400）', price: 10,
    effect: { type: 'permanent_chips_hand', handType: 'STRAIGHT', value: 15, maxPermChips: 400 } },
  { id: 'toffee', name: '太妃糖', emoji: '🍯', rarity: 'epic',
    desc: '每打出一次两对，永久 +2 倍率（上限 60）', price: 12,
    effect: { type: 'permanent_mult_hand', handType: 'TWO_PAIR', value: 2, maxPermMult: 60 } },
  { id: 'honey', name: '蜂蜜糖', emoji: '🍯', rarity: 'epic',
    desc: '每张 JQK 牌给予 +2 倍率', price: 10,
    effect: { type: 'per_rank', ranks: ['J', 'Q', 'K'], mult: 2 } }
];
