/**
 * 切斯特牌 - 商店与三选一渲染
 * 商店布局（4 区域）：
 *   1. ⭐ 牌型强化（横向滚动卡片，可点击升级，附说明文字）
 *   2. 🍬 糖果货架（横向滚动，稀有度标签在右上角）
 *   3. 🎁 特殊商品（20% 概率不出现）
 *   4. 🔄 刷新 + 继续下一关
 * 已拥有糖果：点击卡片切换效果显示
 * 复用 #ccOverlay 容器
 */

import { RARITY_CLASS } from '../data/candies.js';
import {
  getShopOfferings, canAfford, sellPrice
} from '../systems/shop-system.js';
import { canBuySpecialItem } from '../systems/special-item-system.js';
import { canUpgradeShop } from '../systems/shop-level-system.js';
import { HAND_SCORES } from '../core/scoring.js';
import { HAND_TYPES } from '../core/hand-evaluator.js';
import { isOfferingValid } from '../systems/hand-upgrade-system.js';

/**
 * 渲染开局三选一弹窗
 */
export function renderCandyChoice(choices, config) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const cards = choices.map(c => `
    <button class="cc-choice-card ${RARITY_CLASS[c.rarity]}" data-action="pick-candy" data-candy-id="${c.id}">
      <span class="cc-rarity-badge cc-rarity-tag cc-rarity-tag-${c.rarity}">${rarityLabel(c.rarity)}</span>
      <div class="cc-choice-emoji">${c.emoji}</div>
      <div class="cc-choice-name">${c.name}</div>
      <div class="cc-choice-desc">${c.desc}</div>
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

/**
 * 渲染单张糖果卡片
 * @param {Object} c 糖果对象
 * @param {string} mode 'shop' 在售 | 'owned' 已拥有
 * @param {Object} opts { disabled, owned, afford, noSlot }
 */
function renderCandyCard(c, mode, opts = {}) {
  const isOwned = mode === 'owned';
  const refund = isOwned ? sellPrice(c) : 0;
  const disabled = isOwned ? false : (opts.disabled || false);
  const label = isOwned
    ? `回收 +${refund}💰`
    : (opts.owned ? '已拥有' : (opts.noSlot ? '槽位满' : (!opts.afford ? '金币不足' : `${c.price}💰`)));
  const btnClass = isOwned ? 'cc-shop-card-sell' : 'cc-shop-card-buy';
  const action = isOwned ? 'sell-candy' : 'buy-candy';
  const extraData = isOwned
    ? `data-candy-id="${c.id}"`
    : `data-candy-id="${c.id}" data-price="${c.price}"`;
  // 已拥有：desc 默认隐藏，点击卡片切换；在售：desc 显示
  const descClass = isOwned ? 'cc-shop-card-desc is-hidden' : 'cc-shop-card-desc';
  const cardAction = isOwned ? 'data-action="toggle-candy-info"' : '';
  return `
    <div class="cc-shop-card ${RARITY_CLASS[c.rarity]} ${disabled ? 'is-disabled' : ''}" ${cardAction}>
      <span class="cc-rarity-badge cc-rarity-tag cc-rarity-tag-${c.rarity}">${rarityLabel(c.rarity)}</span>
      <div class="cc-shop-card-emoji">${c.emoji}</div>
      <div class="cc-shop-card-name">${c.name}</div>
      <div class="${descClass}">${c.desc}</div>
      <button class="${btnClass} ${disabled ? 'is-disabled' : ''}"
              data-action="${action}" ${extraData}
              ${disabled ? 'disabled' : ''}>
        ${label}
      </button>
    </div>
  `;
}

/**
 * 渲染牌型升级卡片
 * @param {Object} offering { handKey, fromLevel, toLevel, cost, isCombo }
 * @param {Object} handLevels 当前牌型等级表
 * @param {number} coins 玩家当前金币
 */
function renderUpgradeCard(offering, handLevels, coins) {
  const cfg = HAND_SCORES[offering.handKey];
  const stillValid = isOfferingValid(offering, handLevels);
  const afford = canAfford(coins, offering.cost);
  const disabled = !stillValid || !afford;
  const comboTag = offering.isCombo ? '<span class="cc-upgrade-combo-tag">组合</span>' : '';
  const levelDisplay = `Lv.${offering.fromLevel} → Lv.${offering.toLevel}`;
  const bonusChips = cfg.plusChips * (offering.toLevel - 1);
  const bonusMult = cfg.plusMult * (offering.toLevel - 1);
  const cardClass = offering.isCombo ? 'cc-upgrade-card is-combo' : 'cc-upgrade-card';
  return `
    <div class="${cardClass}">
      <div class="cc-upgrade-card-name">${HAND_TYPES[offering.handKey].name}${comboTag}</div>
      <div class="cc-upgrade-card-level">${levelDisplay}</div>
      <div class="cc-upgrade-card-bonus">累计 +${bonusChips}筹码/+${bonusMult}倍</div>
      <div class="cc-upgrade-card-hint">提升该牌型的基础筹码与倍率</div>
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
 * 渲染商店弹窗（4 区域布局）
 */
export function renderShop(state, config) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const candyOfferings = state._candyOfferings || getShopOfferings(state.round);
  const slotsLeft = config.maxCandies - state.candies.length;
  const handLevels = state.handLevels || {};

  // 区域 1：牌型强化
  const upgradeOfferings = state._upgradeOfferings || [];
  const upgradeCards = upgradeOfferings.length > 0
    ? upgradeOfferings.map(o => renderUpgradeCard(o, handLevels, state.coins)).join('')
    : '<div class="cc-shop-empty">所有牌型已达上限</div>';

  // 区域 2：糖果货架（横向滚动）
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

  // 已拥有糖果（横向滚动，点击卡片查看效果）
  const ownedHtml = state.candies.length > 0 ? `
    <div class="cc-shop-section-title">已拥有（点击查看效果）</div>
    <div class="cc-shop-scroll cc-shop-owned-scroll">
      ${state.candies.map(c => renderCandyCard(c, 'owned')).join('')}
    </div>
  ` : '';

  // 区域 3：特殊商品（20% 概率不出现）
  const specialItemHtml = renderSpecialItemCard(state._specialItemOffering, state, config);

  // 区域 4：刷新 + 继续
  const refreshCount = state._refreshCount || 0;
  const refreshHtml = renderRefreshButton(refreshCount);
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
        <div class="cc-shop-scroll cc-shop-upgrade-scroll">${upgradeCards}</div>
      </section>

      <section class="cc-shop-section cc-shop-section-candy">
        <div class="cc-shop-section-title">🍬 糖果 ×${candyOfferings.length}</div>
        <div class="cc-shop-scroll cc-shop-candy-scroll">${items}</div>
        ${ownedHtml}
      </section>

      <section class="cc-shop-section cc-shop-section-special">
        <div class="cc-shop-section-title">🎁 特殊商品</div>
        ${specialItemHtml}
      </section>

      <section class="cc-shop-actions">
        ${refreshHtml}
        <button class="cc-btn cc-btn-primary" data-action="close-shop">继续下一关 →</button>
      </section>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/**
 * 渲染特殊商品卡片
 */
function renderSpecialItemCard(item, state, config) {
  if (!item) {
    return '<div class="cc-shop-empty">本回合无特殊商品</div>';
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

/** 渲染刷新按钮（阶梯价格 0/2/5/10/20，最多 5 次） */
function renderRefreshButton(refreshCount) {
  const REFRESH_PRICES = [0, 2, 5, 10, 20];
  const MAX_REFRESH = 5;
  if (refreshCount >= MAX_REFRESH) {
    return '<button class="cc-btn cc-btn-refresh is-disabled" disabled>🔄 刷新（已达上限）</button>';
  }
  const price = REFRESH_PRICES[refreshCount] || 0;
  const label = price === 0 ? '免费' : `${price}💰`;
  return `<button class="cc-btn cc-btn-refresh" data-action="refresh-shop" data-price="${price}">🔄 刷新（${label}）</button>`;
}

/** 渲染商店等级条 */
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
}
