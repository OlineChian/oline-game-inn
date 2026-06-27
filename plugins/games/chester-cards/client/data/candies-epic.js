/**
 * 切斯特牌 - 史诗糖果数据（5 颗）
 *
 * 效果类型说明：
 *   mult_empty_slot         每个空糖果槽位 ×value 倍率
 *   mult_same_hand          本关再次打出上一关相同牌型时 ×value 倍率
 *   mult_last_play          本关最后一次出牌时 ×value 倍率
 *   mult_deck_used          牌库每减少 1 张牌 +value 倍率
 *   hand_modifier           牌型识别修改（gap_straight: 顺子允许间隔1点）
 */

export const CANDIES_EPIC = [
  { id: 'rainbow', name: '七彩糖', emoji: '🌈', rarity: 'epic',
    desc: '每个空糖果槽位 ×1 倍率', price: 15,
    effect: { type: 'mult_empty_slot', value: 1 } },
  { id: 'gold-choco', name: '金砖巧克力', emoji: '🍫', rarity: 'epic',
    desc: '本关再次打出上一关相同牌型时 ×3 倍率', price: 20,
    effect: { type: 'mult_same_hand', value: 3 } },
  { id: 'infinite', name: '无限糖', emoji: '🍬', rarity: 'epic',
    desc: '本关最后一次出牌时 ×3 倍率', price: 15,
    effect: { type: 'mult_last_play', value: 3 } },
  { id: 'magic-fruit', name: '魔法果糖', emoji: '🍓', rarity: 'epic',
    desc: '牌库每减少 1 张牌 +4 倍率', price: 18,
    effect: { type: 'mult_deck_used', value: 4 } },
  { id: 'dream', name: '梦幻糖', emoji: '🍒', rarity: 'epic',
    desc: '顺子允许间隔 1 个点数', price: 16,
    effect: { type: 'hand_modifier', modifier: 'gap_straight' } }
];
