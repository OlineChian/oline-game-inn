/**
 * 切斯特牌 - 普通糖果数据（21 颗）
 *
 * 效果类型说明：
 *   mult_bonus             固定倍率加成
 *   mult_conditional        牌型条件倍率加成
 *   score_conditional       牌型条件筹码加成
 *   mult_size               手牌张数≤maxSize 时 +value 倍率
 *   permanent_mult_play     出牌 +perPlay 倍率 / 弃牌 +perDiscard 倍率（永久）
 *   permanent_chips_hand    指定牌型出牌时永久 +value 筹码
 *   per_rank                每张指定点数牌给予 chips/mult
 *   per_rank_chance         每张指定点数牌概率给予 ×mult 倍率
 *   per_parity              每张奇/偶点数牌给予 chips/mult
 *   min_rank_to_mult        最低点数牌的点数加入倍率
 */

export const CANDIES_COMMON = [
  // ---------- 基础倍率 ----------
  { id: 'lollipop', name: '棒棒糖', emoji: '🍬', rarity: 'common',
    desc: '+2 倍率', price: 2,
    effect: { type: 'mult_bonus', value: 2 } },

  // ---------- 对子 ----------
  { id: 'fruit-candy', name: '水果糖', emoji: '🍭', rarity: 'common',
    desc: '对子时 +4 倍率', price: 3,
    effect: { type: 'mult_conditional', handType: 'PAIR', value: 4 } },
  { id: 'choco-bar', name: '巧克力', emoji: '🍫', rarity: 'common',
    desc: '对子时 +20 筹码', price: 3,
    effect: { type: 'score_conditional', handType: 'PAIR', value: 20 } },

  // ---------- 两对 ----------
  { id: 'cookie', name: '曲奇', emoji: '🍪', rarity: 'common',
    desc: '两对时 +8 倍率', price: 4,
    effect: { type: 'mult_conditional', handType: 'TWO_PAIR', value: 8 } },
  { id: 'donut', name: '甜甜圈', emoji: '🍩', rarity: 'common',
    desc: '两对时 +40 筹码', price: 4,
    effect: { type: 'score_conditional', handType: 'TWO_PAIR', value: 40 } },

  // ---------- 三条 ----------
  { id: 'strawberry', name: '草莓糖', emoji: '🍓', rarity: 'common',
    desc: '三条时 +12 倍率', price: 4,
    effect: { type: 'mult_conditional', handType: 'THREE_KIND', value: 12 } },
  { id: 'cherry', name: '樱桃糖', emoji: '🍒', rarity: 'common',
    desc: '三条时 +80 筹码', price: 4,
    effect: { type: 'score_conditional', handType: 'THREE_KIND', value: 80 } },

  // ---------- 顺子 ----------
  { id: 'grape', name: '葡萄糖', emoji: '🍇', rarity: 'common',
    desc: '顺子时 +12 倍率', price: 4,
    effect: { type: 'mult_conditional', handType: 'STRAIGHT', value: 12 } },
  { id: 'pineapple', name: '菠萝糖', emoji: '🍍', rarity: 'common',
    desc: '顺子时 +100 筹码', price: 4,
    effect: { type: 'score_conditional', handType: 'STRAIGHT', value: 100 } },

  // ---------- 同花 ----------
  { id: 'watermelon', name: '西瓜糖', emoji: '🍉', rarity: 'common',
    desc: '同花时 +10 倍率', price: 4,
    effect: { type: 'mult_conditional', handType: 'FLUSH', value: 10 } },
  { id: 'lemon', name: '柠檬糖', emoji: '🍋', rarity: 'common',
    desc: '同花时 +80 筹码', price: 4,
    effect: { type: 'score_conditional', handType: 'FLUSH', value: 80 } },

  // ---------- 特殊条件 ----------
  { id: 'cotton-candy', name: '棉花糖', emoji: '🍯', rarity: 'common',
    desc: '手牌仅 3 张或更少时 +20 倍率', price: 5,
    effect: { type: 'mult_size', maxSize: 3, value: 20 } },
  { id: 'milk-candy', name: '牛奶糖', emoji: '🍬', rarity: 'common',
    desc: '每出牌 +1 倍率（永久）；每弃牌 -1 倍率（永久）', price: 4,
    effect: { type: 'permanent_mult_play', perPlay: 1, perDiscard: -1 } },
  { id: 'hazel-choco', name: '榛果巧克力', emoji: '🍫', rarity: 'common',
    desc: '顺子出牌时永久 +15 筹码（递增）', price: 5,
    effect: { type: 'permanent_chips_hand', handType: 'STRAIGHT', value: 15 } },

  // ---------- 点数加成 ----------
  { id: 'creme-brulee', name: '焦糖布丁', emoji: '🍮', rarity: 'common',
    desc: '每张 A 给予 +20 筹码和 +4 倍率', price: 4,
    effect: { type: 'per_rank', ranks: ['A'], chips: 20, mult: 4 } },
  { id: 'jam-candy', name: '果酱糖', emoji: '🍓', rarity: 'common',
    desc: '每张 JQK 牌给予 +5 倍率', price: 6,
    effect: { type: 'per_rank', ranks: ['J', 'Q', 'K'], mult: 5 } },
  { id: 'dark-cookie', name: '黑巧饼干', emoji: '🍪', rarity: 'common',
    desc: '每张 JQK 牌给予 +30 筹码', price: 4,
    effect: { type: 'per_rank', ranks: ['J', 'Q', 'K'], chips: 30 } },
  { id: 'honey', name: '蜂蜜糖', emoji: '🍯', rarity: 'common',
    desc: '每张 JQK 牌给予 ×2 倍率', price: 6,
    effect: { type: 'per_rank_chance', ranks: ['J', 'Q', 'K'], mult: 2 } },
  { id: 'sour-candy', name: '酸糖', emoji: '🍋', rarity: 'common',
    desc: '每张奇数点数牌给予 +30 筹码', price: 7,
    effect: { type: 'per_parity', parity: 'odd', chips: 30 } },
  { id: 'apple', name: '苹果糖', emoji: '🍎', rarity: 'common',
    desc: '每张偶数点数牌给予 +4 倍率', price: 8,
    effect: { type: 'per_parity', parity: 'even', mult: 4 } },
  { id: 'nougat', name: '牛轧糖', emoji: '🍬', rarity: 'common',
    desc: '最低点数牌的点数加入倍率', price: 6,
    effect: { type: 'min_rank_to_mult' } }
];
