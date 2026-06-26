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
import { HAND_SCORES, getHandLevel, upgradeCost } from '../core/scoring.js';
import { HAND_TYPES } from '../core/hand-evaluator.js';

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

/** 渲染牌型升级横向卡片 */
function renderUpgradeCard(key, handLevels, coins) {
  const cfg = HAND_SCORES[key];
  const level = getHandLevel(handLevels, key);
  const cost = upgradeCost(handLevels, key);
  const afford = canAfford(coins, cost);
  return `
    <div class="cc-upgrade-card">
      <div class="cc-upgrade-card-name">${HAND_TYPES[key].name}</div>
      <div class="cc-upgrade-card-level">Lv.${level}</div>
      <div class="cc-upgrade-card-bonus">+${cfg.plusChips}筹码/+${cfg.plusMult}倍</div>
      <button class="cc-upgrade-card-btn ${!afford ? 'is-disabled' : ''}"
              data-action="upgrade-hand" data-hand-key="${key}"
              ${!afford ? 'disabled' : ''}>
        ${cost}💰
      </button>
    </div>
  `;
}

/**
 * 渲染商店弹窗（顶部升级 + 中部糖果 + 底部操作）
 * 电脑端 / 手机端布局一致，手机端全屏
 */
export function renderShop(state, config) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const offerings = getShopOfferings(state.round);
  const drawPrice = getRandomDrawPrice(state.round);
  const slotsLeft = config.maxCandies - state.candies.length;
  const drawDisabled = !canAfford(state.coins, drawPrice) || slotsLeft <= 0;
  const handLevels = state.handLevels || {};

  // 顶部：牌型升级横向滚动卡片
  const upgradeCards = Object.keys(HAND_TYPES)
    .map(key => renderUpgradeCard(key, handLevels, state.coins))
    .join('');

  // 在售糖果卡片网格
  const ownedIds = new Set(state.candies.map(c => c.id));
  const items = offerings.map(c => {
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

  const drawnHtml = drawnCandy ? `
    <div class="cc-shop-drawn">
      <span class="cc-shop-drawn-label">随机抽中：</span>
      <span class="cc-shop-drawn-emoji">${drawnCandy.emoji}</span>
      <span class="cc-shop-drawn-name">${drawnCandy.name}</span>
      <span class="cc-shop-drawn-desc">${drawnCandy.desc}</span>
    </div>
  ` : '';

  overlay.innerHTML = `
    <div class="cc-modal cc-shop-modal">
      <div class="cc-shop-head">
        <h2 class="cc-modal-title">🍬 糖果商店</h2>
        <div class="cc-shop-coin">💰 <span id="ccShopCoins">${state.coins}</span></div>
      </div>
      <p class="cc-modal-desc">第 ${state.round} 关 · 剩余 ${slotsLeft} 个空槽</p>

      <section class="cc-shop-section">
        <div class="cc-shop-section-title">🪐 牌型升级 · 永久 · 本局生效</div>
        <div class="cc-shop-upgrade-scroll">
          ${upgradeCards}
        </div>
      </section>

      <section class="cc-shop-section cc-shop-main">
        <div class="cc-shop-section-title">🍭 在售糖果</div>
        <div class="cc-shop-grid">${items}</div>
        ${ownedHtml}
      </section>

      <section class="cc-shop-actions">
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
