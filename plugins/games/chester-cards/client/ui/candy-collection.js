/**
 * 切斯特牌 - 糖果图鉴（Candy Collection）
 * 渲染全部糖果按稀有度分组的图鉴弹窗，复用 #ccOverlay
 * 数据驱动：新增糖果只需加入 data/candies-*.js，无需修改此文件
 *
 * 展示字段：
 *   emoji / name / desc / price   基础信息
 *   tag                           分类标签（成长型/爆发型/运营型/牌型流/弃牌流/收藏型/倍率型）
 *   rating                        推荐指数 1-5（★☆ 形式）
 *   balanceChange                 V1.1 调整标记（buff/nerf/rework/new）
 */

import { CANDIES, RARITY_CLASS } from '../data/candies.js';

const RARITY_ORDER = ['common', 'rare', 'epic', 'mythic', 'legendary'];
const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', mythic: '神话', legendary: '传奇' };
const FEEDBACK_URL = 'https://qm.qq.com/q/w5F7DvE0Pm';

const BALANCE_BADGE = {
  buff: { text: '▲ Buff', cls: 'cc-badge-buff' },
  nerf: { text: '▼ Nerf', cls: 'cc-badge-nerf' },
  rework: { text: '⚡ Rework', cls: 'cc-badge-rework' },
  new: { text: '✦ New', cls: 'cc-badge-new' }
};

/** 生成星级字符串 ★★★☆☆ */
function renderStars(rating) {
  const r = rating || 0;
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

/** 渲染糖果图鉴弹窗到 #ccOverlay */
export function renderCandyCollection() {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;

  const grouped = {};
  for (const r of RARITY_ORDER) grouped[r] = [];
  for (const candy of CANDIES) {
    if (grouped[candy.rarity]) grouped[candy.rarity].push(candy);
  }

  const changedCount = CANDIES.filter(c => c.balanceChange).length;
  const versionNote = changedCount > 0 ? ` · V1.1 调整 ${changedCount} 颗` : '';

  const sections = RARITY_ORDER.map(rarity => {
    const list = grouped[rarity];
    if (list.length === 0) return '';
    return `
      <section class="cc-collection-section">
        <h3 class="cc-collection-rarity-title cc-rarity-${rarity}">${RARITY_LABEL[rarity]}（${list.length}）</h3>
        <div class="cc-collection-grid">
          ${list.map(c => renderCollectionCard(c)).join('')}
        </div>
      </section>
    `;
  }).join('');

  overlay.innerHTML = `
    <div class="cc-modal cc-collection-modal">
      <button class="cc-settings-close" data-action="close-collection" aria-label="关闭">×</button>
      <h2 class="cc-modal-title">📖 糖果图鉴</h2>
      <p class="cc-modal-desc">共 ${CANDIES.length} 颗糖果 · 按稀有度排列${versionNote}</p>
      ${sections}
      <div class="cc-collection-feedback">
        <a href="${FEEDBACK_URL}" target="_blank" rel="noopener" class="cc-feedback-link">
          💬 平衡性反馈
        </a>
        <p class="cc-collection-feedback-desc">对糖果平衡性有什么建议？有没有新的糖果创意？欢迎告诉我们！</p>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/** 渲染单张图鉴卡片 */
function renderCollectionCard(candy) {
  const badge = candy.balanceChange ? BALANCE_BADGE[candy.balanceChange] : null;
  const tagHtml = candy.tag ? `<div class="cc-collection-card-tag">${candy.tag}</div>` : '';
  const ratingHtml = candy.rating ? `<div class="cc-collection-card-rating" title="推荐指数 ${candy.rating}/5">${renderStars(candy.rating)}</div>` : '';
  const badgeHtml = badge ? `<span class="cc-balance-badge ${badge.cls}">${badge.text}</span>` : '';

  return `
    <div class="cc-collection-card ${RARITY_CLASS[candy.rarity]}">
      ${badgeHtml}
      <span class="cc-rarity-badge cc-rarity-tag cc-rarity-tag-${candy.rarity}">${RARITY_LABEL[candy.rarity]}</span>
      <div class="cc-collection-card-emoji">${candy.emoji}</div>
      <div class="cc-collection-card-name">${candy.name}</div>
      ${tagHtml}
      <div class="cc-collection-card-desc">${candy.desc}</div>
      ${ratingHtml}
      <div class="cc-collection-card-price">售价 ${candy.price} 💰</div>
    </div>
  `;
}
