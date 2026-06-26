/**
 * 切斯特牌 - 糖果数据
 * 阶段 5：20 颗糖果（6 common / 6 rare / 4 epic / 3 mythic / 1 legendary）
 *
 * 稀有度解锁规则：
 *   - common：始终可用
 *   - rare：round >= 2
 *   - epic：round >= 3
 *   - mythic：round >= 4
 *   - legendary：round >= 5
 *
 * 开局三选一：仅 common + rare 池
 * 随机抽选：按 50/30/15/4/1 递减权重
 *
 * 效果类型（effect.type）：
 *   - base_bonus:        基础分加成（如 +10）
 *   - mult_bonus:        倍率加成（如 +1）
 *   - score_conditional: 条件性分数加成（指定 handType）
 *   - mult_conditional:  条件性倍率加成（指定 handType）
 *   - mult_chance:       概率倍率翻倍（chance + mult）
 *   - coin_per_round:    每回合获得金币
 */

export const CANDIES = [
  // ---------- common（6 张）----------
  {
    id: 'hard-candy', name: '硬糖', emoji: '🍬', rarity: 'common',
    desc: '+10 基础分', price: 4,
    effect: { type: 'base_bonus', value: 10 }
  },
  {
    id: 'cotton-candy', name: '棉花糖', emoji: '🍡', rarity: 'common',
    desc: '+5 基础分', price: 4,
    effect: { type: 'base_bonus', value: 5 }
  },
  {
    id: 'caramel', name: '焦糖', emoji: '🍮', rarity: 'common',
    desc: '高牌时 +30 分', price: 4,
    effect: { type: 'score_conditional', handType: 'HIGH_CARD', value: 30 }
  },
  {
    id: 'licorice', name: '甘草糖', emoji: '🍫', rarity: 'common',
    desc: '对子时 +50 分', price: 5,
    effect: { type: 'score_conditional', handType: 'PAIR', value: 50 }
  },
  {
    id: 'fruit-gel', name: '水果糖', emoji: '🍓', rarity: 'common',
    desc: '两对时 +40 分', price: 5,
    effect: { type: 'score_conditional', handType: 'TWO_PAIR', value: 40 }
  },
  {
    id: 'jumping-candy', name: '跳跳糖', emoji: '🎈', rarity: 'common',
    desc: '30% 概率倍率 ×2', price: 5,
    effect: { type: 'mult_chance', chance: 0.3, mult: 2 }
  },

  // ---------- rare（6 张）----------
  {
    id: 'grape', name: '葡萄糖', emoji: '🍇', rarity: 'rare',
    desc: '三条倍率 +2', price: 6,
    effect: { type: 'mult_conditional', handType: 'THREE_KIND', value: 2 }
  },
  {
    id: 'gummy', name: '软糖', emoji: '🐻', rarity: 'rare',
    desc: '葫芦时 +80 分', price: 6,
    effect: { type: 'score_conditional', handType: 'FULL_HOUSE', value: 80 }
  },
  {
    id: 'mint', name: '薄荷糖', emoji: '🌿', rarity: 'rare',
    desc: '顺子倍率 +3', price: 6,
    effect: { type: 'mult_conditional', handType: 'STRAIGHT', value: 3 }
  },
  {
    id: 'lollipop', name: '棒棒糖', emoji: '🍭', rarity: 'rare',
    desc: '25% 概率倍率 ×3', price: 6,
    effect: { type: 'mult_chance', chance: 0.25, mult: 3 }
  },
  {
    id: 'coin-candy', name: '金币糖', emoji: '💰', rarity: 'rare',
    desc: '每回合 +2 金币', price: 5,
    effect: { type: 'coin_per_round', value: 2 }
  },
  {
    id: 'chocolate', name: '巧克力', emoji: '🍪', rarity: 'rare',
    desc: '每回合 +3 金币', price: 6,
    effect: { type: 'coin_per_round', value: 3 }
  },

  // ---------- epic（4 张）----------
  {
    id: 'explosion', name: '爆炸糖', emoji: '💥', rarity: 'epic',
    desc: '所有牌型倍率 +1', price: 8,
    effect: { type: 'mult_bonus', value: 1 }
  },
  {
    id: 'rainbow', name: '彩虹糖', emoji: '🌈', rarity: 'epic',
    desc: '四条倍率 +5', price: 8,
    effect: { type: 'mult_conditional', handType: 'FOUR_KIND', value: 5 }
  },
  {
    id: 'sour', name: '酸糖', emoji: '🍋', rarity: 'epic',
    desc: '20% 概率倍率 ×4', price: 8,
    effect: { type: 'mult_chance', chance: 0.2, mult: 4 }
  },
  {
    id: 'dark-choco', name: '黑巧克力', emoji: '🌑', rarity: 'epic',
    desc: '每回合 +5 金币', price: 8,
    effect: { type: 'coin_per_round', value: 5 }
  },

  // ---------- mythic（3 张）----------
  {
    id: 'diamond', name: '钻石糖', emoji: '💎', rarity: 'mythic',
    desc: '+20 基础分', price: 12,
    effect: { type: 'base_bonus', value: 20 }
  },
  {
    id: 'moonlight', name: '月光糖', emoji: '🌙', rarity: 'mythic',
    desc: '15% 概率倍率 ×5', price: 11,
    effect: { type: 'mult_chance', chance: 0.15, mult: 5 }
  },
  {
    id: 'star', name: '星辰糖', emoji: '⭐', rarity: 'mythic',
    desc: '同花顺倍率 +8', price: 11,
    effect: { type: 'mult_conditional', handType: 'STRAIGHT_FLUSH', value: 8 }
  },

  // ---------- legendary（1 张）----------
  {
    id: 'divine', name: '神圣糖', emoji: '✨', rarity: 'legendary',
    desc: '所有牌型倍率 +3', price: 18,
    effect: { type: 'mult_bonus', value: 3 }
  }
];

/** 按 ID 查糖果 */
export function getCandyById(id) {
  return CANDIES.find(c => c.id === id);
}

/** 稀有度颜色变量名（用于样式） */
export const RARITY_CLASS = {
  common: 'cc-rarity-common',
  rare: 'cc-rarity-rare',
  epic: 'cc-rarity-epic',
  mythic: 'cc-rarity-mythic',
  legendary: 'cc-rarity-legendary'
};

/** 稀有度解锁关卡 */
export const RARITY_UNLOCK_ROUND = {
  common: 1, rare: 2, epic: 3, mythic: 4, legendary: 5
};

/** 随机抽选权重（50/30/15/4/1） */
export const RARITY_WEIGHT = {
  common: 50, rare: 30, epic: 15, mythic: 4, legendary: 1
};
