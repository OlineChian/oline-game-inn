/**
 * 切斯特牌 - 神话糖果数据（4 颗）
 *
 * 效果类型说明：
 *   mythic_factory          回合结束时随机获得 1 个史诗糖果；槽位满时获 coinIfFull 金币
 *   mythic_machine          回合开始时自动回收右侧糖果，永久获得其售价 ×2 的倍率
 *   per_rank                每张指定点数牌给予 mult 加成（糖果马戏团复用）
 *   mythic_magician         每关第一次出牌有 chance 概率立即升级该牌型一级
 */

export const CANDIES_MYTHIC = [
  { id: 'factory', name: '糖果工厂', emoji: '🏭', rarity: 'mythic',
    desc: '每回合结束随机获得 1 个史诗糖果；槽位满时获 8 金币', price: 24,
    effect: { type: 'mythic_factory', rarity: 'epic', coinIfFull: 8 } },
  { id: 'machine', name: '糖果机器', emoji: '⚙️', rarity: 'mythic',
    desc: '回合开始时回收右侧糖果，永久获得其售价 ×2 的倍率', price: 24,
    effect: { type: 'mythic_machine' } },
  { id: 'circus', name: '糖果马戏团', emoji: '🎪', rarity: 'mythic',
    desc: '每张 A 和 10 计分时各给予 +4 倍率', price: 28,
    effect: { type: 'per_rank', ranks: ['A', '10'], mult: 4 } },
  { id: 'magician', name: '糖果魔术师', emoji: '🎭', rarity: 'mythic',
    desc: '每关第一次出牌有 25% 概率立即升级该牌型一级', price: 28,
    effect: { type: 'mythic_magician', chance: 0.25 } }
];
