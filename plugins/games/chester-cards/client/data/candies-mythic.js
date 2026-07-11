/**
 * 切斯特牌 - 神话糖果数据（5 颗）
 *
 * 效果类型说明：
 *   mythic_factory          回合结束时随机获得 1 个史诗糖果；槽位满时获 coinIfFull 金币
 *   mythic_machine          回合开始时自动回收右侧糖果，永久获得其售价 ×2 的倍率（带上限 maxPermMult，不吞传奇/神话）
 *   per_rank                每张指定点数牌给予 mult 加成（糖果马戏团复用）
 *   mythic_magician         每关第一次出牌有 chance 概率立即升级该牌型一级
 *   mult_deck_used          牌库每减少 1 张牌 +value 倍率（带上限 maxMult）
 *
 * 扩展字段：
 *   tag             分类标签（倍率型/牌型流/爆发型/运营型/成长型/弃牌流/收藏型）
 *   rating          推荐指数 1-5（综合考虑触发率、构筑性、前后期、永久性、联动）
 *   balanceChange   V1.1 平衡调整标记（buff/nerf/rework/new），未修改则省略
 */

export const CANDIES_MYTHIC = [
  { id: 'factory', name: '糖果工厂', emoji: '🏭', rarity: 'mythic',
    desc: '每回合结束随机获得 1 个史诗糖果；槽位满时获 8 金币', price: 24,
    effect: { type: 'mythic_factory', rarity: 'epic', coinIfFull: 8 },
    tag: '运营型', rating: 4 },
  { id: 'machine', name: '糖果机器', emoji: '⚙️', rarity: 'mythic',
    desc: '每回合开始时，摧毁最后获得的糖果，永久获得其售价 ×2 的倍率（上限 200，传奇与神话糖果不会被摧毁）', price: 24,
    effect: { type: 'mythic_machine', maxPermMult: 200 },
    tag: '成长型', rating: 4 },
  { id: 'circus', name: '糖果马戏团', emoji: '🎪', rarity: 'mythic',
    desc: '每张 A 和 10 计分时各给予 +10 倍率', price: 28,
    effect: { type: 'per_rank', ranks: ['A', '10'], mult: 10 },
    tag: '倍率型', rating: 4, balanceChange: 'buff' },
  { id: 'magician', name: '糖果魔术师', emoji: '🎭', rarity: 'mythic',
    desc: '每关第一次出牌有 25% 概率立即升级该牌型一级', price: 28,
    effect: { type: 'mythic_magician', chance: 0.25 },
    tag: '运营型', rating: 3 },
  { id: 'magic-fruit', name: '魔法果糖', emoji: '🍓', rarity: 'mythic',
    desc: '牌库每减少 1 张牌 +4 倍率（上限 40）', price: 18,
    effect: { type: 'mult_deck_used', value: 4, maxMult: 40 },
    tag: '运营型', rating: 3 }
];
