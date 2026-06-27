/**
 * 切斯特牌 - 商店等级系统（阶段 8）
 *
 * 5 级商店，升级需要满足两个条件：
 *   1. 达到指定关卡数
 *   2. 花费对应金币
 *
 *   Lv1: 3 商品（初始）
 *   Lv2: 4 商品（关卡 ≥ 8，花费 25 金币）
 *   Lv3: 5 商品（关卡 ≥ 15，花费 50 金币）
 *   Lv4: 传奇概率 +2%（关卡 ≥ 25，花费 80 金币）
 *   Lv5: 每次刷新免费一次（关卡 ≥ 35，花费 120 金币）
 *
 * 传奇概率加成叠加在 luckyBonus 之后（luckyBonus 乘法，shopBonus 加法）
 */

export const SHOP_LEVELS = [
  { level: 1, candyCount: 3, legendaryBonus: 0, freeRefresh: false, upgradeCost: 25, upgradeRound: 8 },
  { level: 2, candyCount: 4, legendaryBonus: 0, freeRefresh: false, upgradeCost: 50, upgradeRound: 15 },
  { level: 3, candyCount: 5, legendaryBonus: 0, freeRefresh: false, upgradeCost: 80, upgradeRound: 25 },
  { level: 4, candyCount: 5, legendaryBonus: 2, freeRefresh: false, upgradeCost: 120, upgradeRound: 35 },
  { level: 5, candyCount: 5, legendaryBonus: 2, freeRefresh: true,  upgradeCost: 0,   upgradeRound: Infinity }
];

export const MAX_SHOP_LEVEL = 5;
export const INITIAL_SHOP_LEVEL = 1;

/** 获取指定等级的配置 */
export function getShopLevelConfig(level) {
  return SHOP_LEVELS.find(l => l.level === level) || SHOP_LEVELS[0];
}

/** 获取指定等级的糖果货架数量 */
export function getCandyCountForLevel(level) {
  return getShopLevelConfig(level).candyCount;
}

/** 获取指定等级的传奇概率加成（百分比点） */
export function getLegendaryBonusForLevel(level) {
  return getShopLevelConfig(level).legendaryBonus;
}

/** 指定等级是否拥有免费刷新（Lv5） */
export function hasFreeRefresh(level) {
  return getShopLevelConfig(level).freeRefresh;
}

/**
 * 检查是否可以升级商店等级
 * upgradeRound/upgradeCost 表示"从当前等级升级到下一级"的需求
 * @returns {Object} { canUpgrade, nextLevel, cost, reason }
 */
export function canUpgradeShop(level, round, coins) {
  if (level >= MAX_SHOP_LEVEL) {
    return { canUpgrade: false, reason: '已达最高等级' };
  }
  const currentConfig = getShopLevelConfig(level);
  const nextLevel = SHOP_LEVELS.find(l => l.level === level + 1);
  if (!nextLevel) {
    return { canUpgrade: false, reason: '无下一级' };
  }
  if (round < currentConfig.upgradeRound) {
    return { canUpgrade: false, reason: `需第 ${currentConfig.upgradeRound} 关` };
  }
  if (coins < currentConfig.upgradeCost) {
    return { canUpgrade: false, reason: `需 ${currentConfig.upgradeCost} 金币` };
  }
  return { canUpgrade: true, nextLevel, cost: currentConfig.upgradeCost };
}
