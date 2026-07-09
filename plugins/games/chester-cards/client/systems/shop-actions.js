/**
 * 切斯特牌 - 商店操作模块
 * 从 main.js 拆分，处理商店中的购买/抽选/回收/升级操作
 * 使用工厂模式，由 main.js 注入 State、CONFIG 和 renderAll
 */

import { getCandyById } from '../data/candies.js';
import { canAddCandy } from './candy-system.js';
import {
  canAfford, sellPrice, getCandyShopOfferings
} from './shop-system.js';
import { upgradeCost, getHandLevel, MAX_HAND_LEVEL } from '../core/scoring.js';
import { getHandUpgradeOfferings, isOfferingValid } from './hand-upgrade-system.js';
import {
  getSpecialItemOffering, applySpecialItem, canBuySpecialItem
} from './special-item-system.js';
import {
  getCandyCountForLevel, hasFreeRefresh, canUpgradeShop
} from './shop-level-system.js';
import { renderShop } from '../ui/shop-ui.js';
import { hideEndScreen } from '../ui/render.js';

/**
 * 创建商店操作集合
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 * @param {Function} renderAll 全量渲染函数
 * @returns {Object} { openShop, buyCandy, sellCandy, upgradeHand, refreshShop, buySpecialItem, upgradeShop }
 */
export function createShopActions(state, config, renderAll) {
  /** 打开商店（从胜利界面进入，刷新牌型升级选项与糖果货架） */
  function openShop() {
    if (state.phase !== 'roundWin') return;
    hideEndScreen();
    // 阶段 4：每次打开商店刷新牌型升级选项
    state._upgradeOfferings = getHandUpgradeOfferings(state.round, state.handLevels);
    // 阶段 5/8：糖果货架数量随商店等级变化（Lv1=3, Lv2=4, Lv3+=5）
    const candyCount = getCandyCountForLevel(state.shopLevel || 1);
    state._candyOfferings = getCandyShopOfferings(state.round, candyCount);
    // 阶段 5：每次打开商店重置刷新次数
    state._refreshCount = 0;
    // 阶段 6：每次打开商店随机生成 1 个特殊商品（20% 概率不出现）
    state._specialItemOffering = getSpecialItemOffering(state.round);
    renderShop(state, config);
  }

  /**
   * 阶段 5/7/8：刷新商店货架
   * - 阶梯价格：第 1 次 0、第 2 次 2、第 3 次 5、第 4 次 10、第 5 次 20
   * - 最多 5 次，每轮（每次打开商店）重置
   * - 阶段 8：Lv5 商店所有刷新免费
   * - 刷新仅重新抽取糖果货架与牌型升级选项；特殊商品不随刷新变化
   */
  function refreshShop() {
    if (state.phase !== 'roundWin') return;
    const REFRESH_PRICES = [0, 2, 5, 10, 20];
    const MAX_REFRESH = 5;
    const count = state._refreshCount || 0;
    if (count >= MAX_REFRESH) return;
    // 阶段 8：Lv5 刷新全部免费
    const isFree = hasFreeRefresh(state.shopLevel || 1);
    const price = isFree ? 0 : (REFRESH_PRICES[count] || 0);
    if (!canAfford(state.coins, price)) return;
    state.coins -= price;
    state._refreshCount = count + 1;
    const candyCount = getCandyCountForLevel(state.shopLevel || 1);
    state._candyOfferings = getCandyShopOfferings(state.round, candyCount);
    state._upgradeOfferings = getHandUpgradeOfferings(state.round, state.handLevels);
    renderShop(state, config);
    renderAll();
  }

  /** 商店：指定糖果购买 */
  function buyCandy(candyId, price) {
    if (state.phase !== 'roundWin') return;
    const candy = getCandyById(candyId);
    if (!candy) return;
    if (!canAfford(state.coins, price)) return;
    if (!canAddCandy(state.candies, config.maxCandies)) return;
    if (state.candies.some(c => c.id === candyId)) return;
    state.coins -= price;
    state.candies.push(candy);
    renderShop(state, config);
    renderAll();
  }

  /** 商店：回收糖果（半价 floor(price/2) 返还） */
  function sellCandy(candyId) {
    if (state.phase !== 'roundWin') return;
    const idx = state.candies.findIndex(c => c.id === candyId);
    if (idx < 0) return;
    const refund = sellPrice(state.candies[idx]);
    state.candies.splice(idx, 1);
    state.coins += refund;
    renderShop(state, config);
    renderAll();
  }

  /**
   * 商店：升级牌型（支持组合升级跨级）
   * 阶段 4：toLevel 可选参数，若指定则直接升级到该等级（组合升级用）
   * @param {string} handKey 牌型 key
   * @param {number} [toLevel] 目标等级（不传则普通 +1 升级）
   */
  function upgradeHand(handKey, toLevel) {
    if (state.phase !== 'roundWin') return;
    const currentLevel = getHandLevel(state.handLevels, handKey);
    const targetLevel = toLevel || (currentLevel + 1);
    // 校验目标等级合法性
    if (targetLevel <= currentLevel || targetLevel > MAX_HAND_LEVEL) return;
    // 价格 = 升级到 targetLevel 的价格（基于 targetLevel - 1 的等级表查询）
    const tempLevels = { ...state.handLevels, [handKey]: targetLevel - 1 };
    const cost = upgradeCost(tempLevels, handKey);
    if (!canAfford(state.coins, cost)) return;
    state.coins -= cost;
    state.handLevels = { ...state.handLevels, [handKey]: targetLevel };
    renderShop(state, config);
    renderAll();
  }

  /**
   * 阶段 6：购买特殊商品
   * - 校验 phase、_specialItemOffering 匹配、可购买、金币足够
   * - 扣钱后应用效果，若应用失败回滚金币
   * - 购买后清空特殊商品槽位（设为 null）
   * @param {string} itemId 特殊商品 id
   */
  function buySpecialItem(itemId) {
    if (state.phase !== 'roundWin') return;
    const item = state._specialItemOffering;
    if (!item || item.id !== itemId) return;
    if (!canBuySpecialItem(item, state, config)) return;
    if (!canAfford(state.coins, item.price)) return;
    state.coins -= item.price;
    const result = applySpecialItem(item, state, config);
    if (!result.success) {
      // 应用失败，回滚金币
      state.coins += item.price;
      return;
    }
    // 购买后特殊商品槽位清空
    state._specialItemOffering = null;
    renderShop(state, config);
    renderAll();
  }

  /**
   * 阶段 8：升级商店等级
   * - 需满足关卡要求 + 金币要求
   * - 升级后重新生成货架（商品数量可能变化）
   */
  function upgradeShop() {
    if (state.phase !== 'roundWin') return;
    const check = canUpgradeShop(state.shopLevel || 1, state.round, state.coins);
    if (!check.canUpgrade) return;
    state.coins -= check.cost;
    state.shopLevel = (state.shopLevel || 1) + 1;
    // 升级后重新生成货架（商品数量可能变化）
    const candyCount = getCandyCountForLevel(state.shopLevel);
    state._candyOfferings = getCandyShopOfferings(state.round, candyCount);
    renderShop(state, config);
    renderAll();
  }

  return { openShop, buyCandy, sellCandy, upgradeHand, refreshShop, buySpecialItem, upgradeShop };
}
