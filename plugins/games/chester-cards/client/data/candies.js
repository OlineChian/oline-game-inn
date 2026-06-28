/**
 * 切斯特牌 - 糖果数据汇总入口
 * 合并 5 个稀有度子模块，对外统一导出
 *
 * 糖果总数：35 颗（21 common + 4 rare + 4 epic + 4 mythic + 2 legendary）
 * 数据按稀有度拆分以遵守单文件 ≤300 行铁律
 *
 * Wave 解锁规则（替代旧的固定关卡解锁）：
 *   Wave 1-10（关 1-10）：  普通 70% / 稀有 25% / 史诗 5%
 *   Wave 11-30（关 11-30）：普通 45% / 稀有 35% / 史诗 15% / 神话 5%
 *   Wave 30+（关 30+）：    普通 30% / 稀有 35% / 史诗 20% / 神话 10% / 传奇 5%
 */

import { CANDIES_COMMON } from './candies-common.js';
import { CANDIES_RARE } from './candies-rare.js';
import { CANDIES_EPIC } from './candies-epic.js';
import { CANDIES_MYTHIC } from './candies-mythic.js';
import { CANDIES_LEGENDARY } from './candies-legendary.js';

/** 全部糖果（合并所有稀有度） */
export const CANDIES = [
  ...CANDIES_COMMON,
  ...CANDIES_RARE,
  ...CANDIES_EPIC,
  ...CANDIES_MYTHIC,
  ...CANDIES_LEGENDARY
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

/**
 * 稀有度解锁关卡（基于 Wave 系统）
 * 阶段 2 将实现完整的 Wave 权重，此处仅控制池子可用性
 */
export const RARITY_UNLOCK_ROUND = {
  common: 1, rare: 1, epic: 1, mythic: 11, legendary: 30
};

/**
 * 旧版权重（向后兼容，阶段 2 将被 Wave 系统替代）
 */
export const RARITY_WEIGHT = {
  common: 50, rare: 30, epic: 15, mythic: 4, legendary: 1
};
