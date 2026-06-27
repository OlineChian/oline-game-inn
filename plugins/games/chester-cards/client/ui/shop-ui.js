/**
 * 切斯特牌 - 商店与三选一渲染
 * 阶段 7：商店布局优化（霓虹风格）
 *   - 顶部：牌型升级（横向滚动卡片式，可点击升级）
 *   - 中部：糖果网格（已拥有直接显示售出按钮+回收价）
 *   - 底部：随机抽选 + 继续下一关
 *   电脑端 / 手机端布局一致，手机端全屏
 * 复用 #ccOverlay 容器
 */

import { RARITY_CLASS } from '../data/candies.js';
import {
  getShopOfferings, getRandomDrawPrice, canAfford, sellPrice
} from '../systems/shop-system.js';
import { canBuySpecialItem } from '../systems/special-item-system.js';
import { canUpgradeShop } from '../systems/shop-level-system.js';
import { HAND_SCORES } from '../core/scoring.js';
import { HAND_TYPES } from '../core/hand-evaluator.js';
import { isOfferingValid } from '../systems/hand-upgrade-system.js';

/** 抽中糖果的临时展示（模块级） */
let drawnCandy = null;

export function setDrawnCandy(candy) { drawnCandy = candy; }
export function resetDrawnCandy() { drawnCandy = null; }
export function getDrawnCandy() { return drawnCandy; }

/**
 * 渲染开局三选一弹窗
 * @param {Array} choices 3 张糖果
 * @param {Object} config 配置（用于 maxCandies 提示）
 */
export function renderCandyChoice(choices, config) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const cards = choices.map(c => `
    <button class="cc-choice-card ${RARITY_CLASS[c.rarity]}" data-action="pick-candy" data-candy-id="${c.id}">
      <div class="cc-choice-emoji">${c.emoji}</div>
      <div class="cc-choice-name">${c.name}</div>
      <div class="cc-choice-desc">${c.desc}</div>
      <div class="cc-choice-rarity cc-rarity-tag cc-rarity-tag-${c.rarity}">${rarityLabel(c.rarity)}</div>
    </button>
  `).join('');
  overlay.innerHTML = `
    <div class="cc-modal cc-choice-modal">
      <div class="cc-modal-icon">🎁</div>
      <h2 class="cc-modal-title">选择初始糖果</h2>
      <p class="cc-modal-desc">从 3 张中选 1 张作为开局增益（共 ${config.maxCandies} 槽）</p>
      <div class="cc-choice-grid">${cards}</div>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/** 渲染单张糖果卡片（在售 / 已拥有共用） */
function renderCandyCard(c, mode, opts = {}) {
  const refund = mode === 'owned' ? sellPrice(c) : 0;
  const disabled = mode === 'owned' ? false : (opts.disabled || false);
  const label = mode === 'owned'
    ? `回收 +${refund}💰`
    : (opts.owned ? '已拥有' : (opts.noSlot ? '槽位满' : (!opts.afford ? '金币不足' : `${c.price}💰`)));
  const btnClass = mode === 'owned' ? 'cc-shop-card-sell' : 'cc-shop-card-buy';
  const action = mode === 'owned' ? 'sell-candy' : 'buy-candy';
  const extraData = mode === 'owned'
    ? `data-candy-id="${c.id}"`
    : `data-candy-id="${c.id}" data-price="${c.price}"`;
  return `
    <div class="cc-shop-card ${RARITY_CLASS[c.rarity]} ${disabled ? 'is-disabled' : ''}">
      <div class="cc-shop-card-emoji">${c.emoji}</div>
      <div class="cc-shop-card-name">${c.name}</div>
      <div class="cc-rarity-tag cc-rarity-tag-${c.rarity}">${rarityLabel(c.rarity)}</div>
      <div class="cc-shop-card-desc">${c.desc}</div>
      <button class="${btnClass} ${disabled ? 'is-disabled' : ''}"
              data-action="${action}" ${extraData}
              ${disabled ? 'disabled' : ''}>
        ${label}
      </button>
    </div>
  `;
}

/**
 * 渲染牌型升级卡片（阶段 4：基于升级选项）
 * @param {Object} offering 升级选项 { handKey, fromLevel, toLevel, cost, isCombo }
 * @param {Object} handLevels 当前牌型等级表
 * @param {number} coins 玩家当前金币
 */
function renderUpgradeCard(offering, handLevels, coins) {
  const cfg = HAND_SCORES[offering.handKey];
  const stillValid = isOfferingValid(offering, handLevels);
  const afford = canAfford(coins, offering.cost);
  const disabled = !stillValid || !afford;
  const comboTag = offering.isCombo ? '<span class="cc-upgrade-combo-tag">组合</span>' : '';
  const levelDisplay = offering.isCombo
    ? `Lv.${offering.fromLevel} → Lv.${offering.toLevel}`
    : `Lv.${offering.fromLevel} → Lv.${offering.toLevel}`;
  const bonusChips = cfg.plusChips * (offering.toLevel - 1);
  const bonusMult = cfg.plusMult * (offering.toLevel - 1);
  const cardClass = offering.isCombo ? 'cc-upgrade-card is-combo' : 'cc-upgrade-card';
  return `
    <div class="${cardClass}">
      <div class="cc-upgrade-card-name">${HAND_TYPES[offering.handKey].name}${comboTag}</div>
      <div class="cc-upgrade-card-level">${levelDisplay}</div>
      <div class="cc-upgrade-card-bonus">累计 +${bonusChips}筹码/+${bonusMult}倍</div>
      <button class="cc-upgrade-card-btn ${disabled ? 'is-disabled' : ''}"
              data-action="upgrade-hand" data-hand-key="${offering.handKey}"
              data-to-level="${offering.toLevel}"
              ${disabled ? 'disabled' : ''}>
        ${offering.cost}💰
      </button>
    </div>
  `;
}

/**
 * 渲染商店弹窗（阶段 5：4 区域布局）
 *   1. ⭐ 牌型强化 ×2（升级选项）
 *   2. 🍬 糖果 ×3（随机抽取的可购买糖果）
 *   3. 🎁 特殊商品 ×1（阶段 6 实现，当前占位）
 *   4. 🔄 刷新（阶段 7 实现，当前占位）+ 随机抽选 + 继续下一关
 * 电脑端 / 手机端布局一致，手机端全屏
 */
export function renderShop(state, config) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  // 阶段 5：糖果货架从全部可购买改为随机抽 3 个
  const candyOfferings = state._candyOfferings || getShopOfferings(state.round);
  const drawPrice = getRandomDrawPrice(state.round);
  const slotsLeft = config.maxCandies - state.candies.length;
  const drawDisabled = !canAfford(state.coins, drawPrice) || slotsLeft <= 0;
  const handLevels = state.handLevels || {};

  // 区域 1：牌型强化 ×2（阶段 4：基于升级选项）
  const upgradeOfferings = state._upgradeOfferings || [];
  const upgradeCards = upgradeOfferings.length > 0
    ? upgradeOfferings.map(o => renderUpgradeCard(o, handLevels, state.coins)).join('')
    : '<div class="cc-shop-empty">所有牌型已达上限</div>';

  // 区域 2：糖果 ×3（在售糖果卡片网格）
  const ownedIds = new Set(state.candies.map(c => c.id));
  const items = candyOfferings.map(c => {
    const owned = ownedIds.has(c.id);
    const afford = canAfford(state.coins, c.price);
    const noSlot = slotsLeft <= 0;
    return renderCandyCard(c, 'shop', {
      disabled: owned || !afford || noSlot,
      owned, afford, noSlot
    });
  }).join('');

  // 已拥有糖果（直接显示回收按钮+回收价）
  const ownedHtml = state.candies.length > 0 ? `
    <div class="cc-shop-section-title">已拥有（点击回收，半价返还）</div>
    <div class="cc-shop-grid cc-shop-owned-grid">
      ${state.candies.map(c => renderCandyCard(c, 'owned')).join('')}
    </div>
  ` : '';

  // 区域 3：特殊商品 ×1（阶段 6：真实渲染）
  const specialItemHtml = renderSpecialItemCard(state._specialItemOffering, state, config);

  // 区域 4：刷新按钮（阶段 7 占位，价格阶梯 0/2/5/10/20）
  const refreshCount = state._refreshCount || 0;
  const refreshHtml = renderRefreshButton(refreshCount);

  const drawnHtml = drawnCandy ? `
    <div class="cc-shop-drawn">
      <span class="cc-shop-drawn-label">随机抽中：</span>
      <span class="cc-shop-drawn-emoji">${drawnCandy.emoji}</span>
      <span class="cc-shop-drawn-name">${drawnCandy.name}</span>
      <span class="cc-shop-drawn-desc">${drawnCandy.desc}</span>
    </div>
  ` : '';

  // 阶段 8：商店等级条（等级 + 升级按钮）
  const shopLevelBar = renderShopLevelBar(state);

  overlay.innerHTML = `
    <div class="cc-modal cc-shop-modal">
      <div class="cc-shop-head">
        <h2 class="cc-modal-title">🍬 糖果商店</h2>
        <div class="cc-shop-level-bar">${shopLevelBar}</div>
        <div class="cc-shop-coin">💰 <span id="ccShopCoins">${state.coins}</span></div>
      </div>
      <p class="cc-modal-desc">第 ${state.round} 关 · 剩余 ${slotsLeft} 个空槽</p>

      <section class="cc-shop-section cc-shop-section-hand">
        <div class="cc-shop-section-title">⭐ 牌型强化 ×${upgradeOfferings.length}</div>
        <div class="cc-shop-upgrade-scroll">${upgradeCards}</div>
      </section>

      <section class="cc-shop-section cc-shop-section-candy">
        <div class="cc-shop-section-title">🍬 糖果 ×${candyOfferings.length}</div>
        <div class="cc-shop-grid">${items}</div>
        ${ownedHtml}
      </section>

      <section class="cc-shop-section cc-shop-section-special">
        <div class="cc-shop-section-title">🎁 特殊商品 ×1</div>
        ${specialItemHtml}
      </section>

      <section class="cc-shop-actions">
        ${refreshHtml}
        <button class="cc-btn cc-btn-random ${drawDisabled ? 'is-disabled' : ''}"
                data-action="draw-random" data-price="${drawPrice}" ${drawDisabled ? 'disabled' : ''}>
          🎲 随机抽选（${drawPrice}💰）
        </button>
        ${drawnHtml}
        <button class="cc-btn cc-btn-primary" data-action="close-shop">继续下一关 →</button>
      </section>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/**
 * 阶段 6：渲染特殊商品卡片
 * @param {Object} item 特殊商品对象（或 null 表示已售罄）
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 */
function renderSpecialItemCard(item, state, config) {
  if (!item) {
    return '<div class="cc-shop-empty cc-shop-special-placeholder">本回合特殊商品已售罄</div>';
  }
  const canBuy = canBuySpecialItem(item, state, config);
  const afford = canAfford(state.coins, item.price);
  const disabled = !canBuy || !afford;
  let label = `${item.price}💰`;
  if (!canBuy) label = '条件不足';
  else if (!afford) label = '金币不足';
  return `
    <div class="cc-shop-card cc-shop-special-card ${disabled ? 'is-disabled' : ''}">
      <div class="cc-shop-card-emoji">${item.emoji}</div>
      <div class="cc-shop-card-name">${item.name}</div>
      <div class="cc-shop-card-desc">${item.desc}</div>
      <button class="cc-shop-card-buy ${disabled ? 'is-disabled' : ''}"
              data-action="buy-special-item" data-item-id="${item.id}"
              ${disabled ? 'disabled' : ''}>
        ${label}
      </button>
    </div>
  `;
}

/**
 * 阶段 7 占位：渲染刷新按钮
 * 阶段 7 将实现阶梯价格 0/2/5/10/20 + 最多 5 次
 * @param {number} refreshCount 当前已刷新次数
 */
function renderRefreshButton(refreshCount) {
  // 阶段 7 阶梯价格：第 1 次 0、第 2 次 2、第 3 次 5、第 4 次 10、第 5 次 20
  const REFRESH_PRICES = [0, 2, 5, 10, 20];
  const MAX_REFRESH = 5;
  if (refreshCount >= MAX_REFRESH) {
    return '<button class="cc-btn cc-btn-refresh is-disabled" disabled>🔄 刷新（已达上限）</button>';
  }
  const price = REFRESH_PRICES[refreshCount] || 0;
  const label = price === 0 ? '免费' : `${price}💰`;
  return `<button class="cc-btn cc-btn-refresh" data-action="refresh-shop" data-price="${price}">🔄 刷新（${label}）</button>`;
}

/**
 * 阶段 8：渲染商店等级条（等级显示 + 升级按钮）
 * @param {Object} state 游戏状态
 */
function renderShopLevelBar(state) {
  const level = state.shopLevel || 1;
  const check = canUpgradeShop(level, state.round, state.coins);
  if (!check.canUpgrade) {
    return `<span class="cc-shop-level-info">商店 Lv${level}（${check.reason}）</span>`;
  }
  return `
    <span class="cc-shop-level-info">商店 Lv${level}</span>
    <button class="cc-btn cc-btn-upgrade-shop" data-action="upgrade-shop">
      升级 → Lv${level + 1}（${check.cost}💰）
    </button>
  `;
}

/** 稀有度中文标签 */
function rarityLabel(rarity) {
  return { common: '普通', rare: '稀有', epic: '史诗', mythic: '神话', legendary: '传奇' }[rarity] || '';
}

/** 隐藏商店/选择弹窗 */
export function hideShop() {
  const overlay = document.getElementById('ccOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }
  resetDrawnCandy();
}
