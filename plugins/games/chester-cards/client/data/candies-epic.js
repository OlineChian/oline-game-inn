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
 *
 * 扩展字段：
 *   tag             分类标签（倍率型/牌型流/爆发型/运营型/成长型/弃牌流/收藏型）
 *   rating          推荐指数 1-5（综合考虑触发率、构筑性、前后期、永久性、联动）
 *   balanceChange   V1.1 平衡调整标记（buff/nerf/rework/new），未修改则省略
 *
 * 乘法价值说明（multMul 与 multAdd 不可直接比较）：
 *   ×N 倍率在已有倍率 M 时等效增加 M×(N-1)，故 multMul 的实际价值随游戏进程递增。
 *   本组 gold-choco/infinite/rainbow 均为 multMul，评估时需考虑"已有倍率"的放大效应。
 */

export const CANDIES_EPIC = [
  { id: 'rainbow', name: '七彩糖', emoji: '🌈', rarity: 'epic',
    desc: '每个空糖果槽位 ×2 倍率', price: 15,
    effect: { type: 'mult_empty_slot', value: 2 },
    tag: '收藏型', rating: 3 },
  { id: 'gold-choco', name: '金砖巧克力', emoji: '🍫', rarity: 'epic',
    desc: '本关连续两次打出相同牌型时 ×3 倍率', price: 15,
    effect: { type: 'mult_same_hand', value: 3 },
    tag: '运营型', rating: 2, balanceChange: 'buff' },
  { id: 'infinite', name: '无限糖', emoji: '🍬', rarity: 'epic',
    desc: '本关最后一次出牌时 ×3 倍率', price: 15,
    effect: { type: 'mult_last_play', value: 3 },
    tag: '爆发型', rating: 3 },
  { id: 'hazel-choco', name: '榛果巧克力', emoji: '🍫', rarity: 'epic',
    desc: '三条出牌时永久 +20 筹码（上限 400）', price: 12,
    effect: { type: 'permanent_chips_hand', handType: 'THREE_KIND', value: 20, maxPermChips: 400 },
    tag: '成长型', rating: 3, balanceChange: 'rework' },
  { id: 'toffee', name: '太妃糖', emoji: '🍯', rarity: 'epic',
    desc: '每打出一次两对，永久 +4 倍率（上限 80）', price: 12,
    effect: { type: 'permanent_mult_hand', handType: 'TWO_PAIR', value: 4, maxPermMult: 80 },
    tag: '成长型', rating: 3, balanceChange: 'buff' },
  { id: 'honey', name: '蜂蜜糖', emoji: '🍯', rarity: 'epic',
    desc: '每张 JQK 牌给予 +6 倍率', price: 12,
    effect: { type: 'per_rank', ranks: ['J', 'Q', 'K'], mult: 6 },
    tag: '倍率型', rating: 4, balanceChange: 'buff' }
];
