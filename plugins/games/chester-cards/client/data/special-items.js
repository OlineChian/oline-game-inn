/**
 * 切斯特牌 - 特殊商品数据（阶段 6）
 *
 * 商店第三区域 "🎁 特殊商品 ×1"，每次打开商店随机生成 1 个
 *
 * 效果类型说明：
 *   random_candy      获得指定稀有度的随机糖果
 *   coin_gain         立即获得 value 金币
 *   recycle_candy     原价回收一个糖果（自动回收最早拥有的）
 */

export const SPECIAL_ITEMS = [
  {
    id: 'candy-box',
    name: '糖果盒',
    emoji: '🍬',
    price: 18,
    desc: '随机获得 1 颗普通糖果',
    effect: { type: 'random_candy', rarity: 'common' }
  },
  {
    id: 'mystery-bag',
    name: '神秘礼包',
    emoji: '🎲',
    price: 25,
    desc: '随机获得 1 颗稀有糖果',
    effect: { type: 'random_candy', rarity: 'rare' }
  },
  {
    id: 'piggy-bank',
    name: '存钱罐',
    emoji: '💰',
    price: 15,
    desc: '立即获得 25 金币',
    effect: { type: 'coin_gain', value: 25 }
  },
  {
    id: 'recycle-coupon',
    name: '回收券',
    emoji: '🧹',
    price: 5,
    desc: '原价回收 1 颗糖果（自动回收最早拥有的）',
    effect: { type: 'recycle_candy' }
  }
];

/** 根据 id 获取特殊商品 */
export function getSpecialItemById(id) {
  return SPECIAL_ITEMS.find(it => it.id === id);
}
