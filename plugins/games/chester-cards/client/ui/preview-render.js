/**
 * 切斯特牌 - 实时预览渲染
 * 从 render.js 拆分，处理选牌时的牌型与分数预览
 *
 * 实时计算选牌的牌型与分数（应用糖果效果）
 * mult_chance 类型糖果不实际掷骰子，仅标记「机会加成」，避免预览分数跳动
 */

import { scoreHand } from '../core/scoring.js';
import { previewCandiesToScore, hasHandModifier } from '../systems/candy-system.js';

/**
 * 实时分数预览（选牌时显示当前牌型与分数）
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 */
export function renderLivePreview(state, config) {
  const previewEl = document.getElementById('ccPreview');
  if (!previewEl) return;
  // 非游戏中状态隐藏预览
  if (state.phase !== 'playing') {
    previewEl.classList.add('hidden');
    return;
  }
  previewEl.classList.remove('hidden');

  // 未选牌时显示提示
  if (state.selected.size === 0) {
    previewEl.innerHTML = `<div class="cc-preview-hint">选择 ${config.maxPlay} 张以内的牌查看实时牌型与分数</div>`;
    return;
  }

  // 计算当前选牌的牌型与分数（应用牌型升级等级）
  const played = state.hand.filter(c => state.selected.has(c.id));
  const baseResult = scoreHand(played, state.handLevels || {}, {
    allowShortHand: hasHandModifier(state.candies, 'short_hand')
  });
  if (!baseResult.handType) {
    previewEl.innerHTML = `<div class="cc-preview-hint">无效牌组</div>`;
    return;
  }
  const context = {
    playedCards: played,
    deckUsed: state.deck ? 52 - state.deck.length : 0,
    isLastPlayOfRound: state.playsLeft <= 1,
    prevPlayHandType: state.prevPlayHandType,
    maxCandies: config.maxCandies,
    candyCount: state.candies.length
  };
  const result = previewCandiesToScore(baseResult, state.candies, context);
  // mult_chance 机会块：得分后以「或」连接，显示触发后的潜在得分
  const chanceBlocks = result.triggered.filter(t => t.isChance);
  const chanceBlocksHtml = chanceBlocks.map(t => {
    const potentialMult = result.mult * t.candy.effect.mult;
    const potentialScore = (result.base + result.chips) * potentialMult;
    const chancePct = Math.round(t.candy.effect.chance * 100);
    return `<div class="cc-formula-op cc-formula-or">或</div>
      <div class="cc-formula-block cc-formula-chance">
        <div class="cc-formula-label">${t.candy.name}效果<br>${chancePct}% ×${t.candy.effect.mult}倍</div>
        <div class="cc-formula-value">${potentialScore}</div>
      </div>`;
  }).join('');
  // 非机会类糖果触发列表
  const normalTriggers = result.triggered.filter(t => !t.isChance);
  const triggersHtml = normalTriggers.length > 0
    ? `<div class="cc-preview-triggers">
        ${normalTriggers.map(t => `<span class="cc-preview-trigger cc-trigger-${t.candy.rarity}">${t.candy.emoji} ${t.msg}</span>`).join('')}
      </div>`
    : '';
  const levelTag = baseResult.level > 1 ? ` <span class="cc-preview-level">Lv.${baseResult.level}</span>` : '';

  previewEl.innerHTML = `
    <div class="cc-preview-hand">${result.handType.name}${levelTag}</div>
    <div class="cc-formula-viz">
      <div class="cc-formula-block">
        <div class="cc-formula-label">基础筹码</div>
        <div class="cc-formula-value">${result.base}</div>
      </div>
      <div class="cc-formula-op">+</div>
      <div class="cc-formula-block">
        <div class="cc-formula-label">牌面筹码</div>
        <div class="cc-formula-value">${result.chips}</div>
      </div>
      <div class="cc-formula-op">×</div>
      <div class="cc-formula-block">
        <div class="cc-formula-label">倍率</div>
        <div class="cc-formula-value">${result.mult}</div>
      </div>
      <div class="cc-formula-op">=</div>
      <div class="cc-formula-block cc-formula-result">
        <div class="cc-formula-label">得分</div>
        <div class="cc-formula-value">${result.score}</div>
      </div>
      ${chanceBlocksHtml}
    </div>
    ${triggersHtml}
  `;
}
