/**
 * 切斯特牌 - 渲染模块
 * 阶段 2：含糖果槽渲染与得分动效触发列表
 * 阶段 6：实时分数预览（选牌时显示牌型与分数）→ 拆分到 preview-render.js
 * 纯 DOM 操作，状态由 main.js 推送
 *
 * Wave/UI 重构：
 *   - HUD 顶部仅保留关卡胶囊（点击触发糖果面板）+ 目标/得分胶囊（三态显示）+ 设置按钮
 *   - 出牌/弃牌按钮双行结构（动作名 + 剩余次数）
 *   - 糖果查看由 panel-render.js 的 renderCandyPanel 承担（移动端侧滑 / 电脑端常驻）
 */

import { getTarget } from '../core/targets.js';
import { renderVictorySubmitSection } from './submit-section.js';
import { renderCandyPanel } from './panel-render.js';
import { hasSave } from '../systems/save-system.js';

// 实时预览渲染已拆分到 preview-render.js
export { renderLivePreview } from './preview-render.js';

/** 主入口容器渲染（无尽模式，无关卡总数） */
export function renderGame(config) {
  const stage = document.getElementById('chesterStage');
  stage.innerHTML = `
    <header class="cc-hud">
      <div class="cc-hud-row cc-hud-row-main">
        <div class="cc-hud-pill cc-pill-round" data-action="toggle-candy-panel">
          <span class="cc-hud-label">点击查看糖果</span>
          <span class="cc-round-num">第 <span id="ccRoundCurrent">1</span> 关</span>
        </div>
        <div class="cc-hud-pill cc-pill-score">
          <span class="cc-score-label" id="ccScoreLabel">目标分</span>
          <span class="cc-score-value" id="ccScoreValue">0</span>
        </div>
        <button class="cc-hud-settings" data-action="open-settings" aria-label="设置">
          <svg viewBox="0 0 24 24" class="cc-icon-gear" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
      </div>
    </header>

    <div class="cc-preview hidden" id="ccPreview"></div>

    <section class="cc-table" id="ccTable">
      <div class="cc-hand" id="ccHand"></div>
      <div class="cc-actions">
        <button class="cc-btn cc-btn-play" data-action="play">
          <span class="cc-btn-label">出牌</span>
          <span class="cc-btn-sub">剩余次数：<span id="ccPlaysLeft">4</span></span>
        </button>
        <button class="cc-btn cc-btn-discard" data-action="discard">
          <span class="cc-btn-label">弃牌</span>
          <span class="cc-btn-sub">剩余次数：<span id="ccDiscardsLeft">2</span></span>
        </button>
      </div>
    </section>

    <aside class="cc-candy-panel hidden" id="ccCandyPanel"></aside>
    <aside class="cc-candy-sidebar hidden" id="ccCandySidebar"></aside>

    <div class="cc-overlay cc-settings-overlay hidden" id="ccSettingsOverlay"></div>
    <div class="cc-overlay hidden" id="ccOverlay"></div>
    <div class="cc-score-popup hidden" id="ccPopup"></div>
  `;
}

/** 渲染手牌 */
export function renderHand(state) {
  const handEl = document.getElementById('ccHand');
  handEl.innerHTML = state.hand.map(card => {
    const selected = state.selected.has(card.id);
    const suitClass = card.isRed ? 'cc-card-red' : 'cc-card-black';
    return `<button class="cc-card ${suitClass} ${selected ? 'is-selected' : ''}"
              data-id="${card.id}" type="button">
      <span class="cc-card-rank">${card.rank}</span>
      <span class="cc-card-suit">${card.suit}</span>
    </button>`;
  }).join('');
}

/** 渲染 HUD（关卡 + 目标/得分三态显示 + 按钮剩余次数 + 糖果面板同步） */
export function renderHUD(state, config) {
  const target = getTarget(state.round);
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText('ccRoundCurrent', state.round);

  const scoreLabel = document.getElementById('ccScoreLabel');
  const scoreValue = document.getElementById('ccScoreValue');
  if (scoreLabel && scoreValue) {
    if (state.roundScore === 0) {
      scoreLabel.textContent = '目标分';
      scoreValue.textContent = target;
    } else if (state.roundScore < target) {
      scoreLabel.textContent = `已得分 （还差：${target - state.roundScore}）`;
      scoreValue.textContent = state.roundScore;
    } else {
      scoreLabel.textContent = '已得分';
      scoreValue.textContent = state.roundScore;
    }
  }

  setText('ccPlaysLeft', state.playsLeft);
  setText('ccDiscardsLeft', state.discardsLeft);

  const playBtn = document.querySelector('.cc-btn-play');
  const discardBtn = document.querySelector('.cc-btn-discard');
  if (playBtn) playBtn.disabled = state.selected.size === 0 || state.playsLeft <= 0;
  if (discardBtn) discardBtn.disabled = state.selected.size === 0 || state.discardsLeft <= 0;

  renderCandyPanel(state, config);
}

/** 得分动效（含糖果触发列表） */
export function showScorePopup(result) {
  const popup = document.getElementById('ccPopup');
  if (!popup) return;
  const triggers = result.triggered && result.triggered.length > 0
    ? `<div class="cc-popup-triggers">
        ${result.triggered.map(t => `<span class="cc-popup-trigger cc-trigger-${t.candy.rarity}">${t.candy.emoji} ${t.msg}</span>`).join('')}
      </div>`
    : '';
  popup.innerHTML = `
    <div class="cc-popup-hand">${result.handType.name}</div>
    <div class="cc-popup-formula">${result.formula}</div>
    ${triggers}
    <div class="cc-popup-score">+${result.score}</div>
  `;
  popup.classList.remove('hidden');
  popup.classList.add('cc-popup-show');
  setTimeout(() => {
    popup.classList.add('hidden');
    popup.classList.remove('cc-popup-show');
  }, 1800);
}

/** 结束界面（无尽模式：过关/失败/退出）
 * 过关：显示金币结算 + 进入商店按钮
 * 失败/退出：显示提交 UI + 再来一局按钮
 * opts.submitState: undefined | 'submitting' | 'success' | 'fail'
 */
export function renderEndScreen(state, config, opts = {}) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const target = getTarget(state.round);
  const isRoundWin = state.phase === 'roundWin';
  const isLose = state.phase === 'roundLose';
  const isQuit = state.phase === 'quit';
  if (!isRoundWin && !isLose && !isQuit) { overlay.classList.add('hidden'); return; }

  let icon, title, desc, btnLabel, btnAction, extraHtml = '';
  if (isRoundWin) {
    icon = '🎉';
    title = `第 ${state.round} 关完成`;
    desc = `本关 ${state.roundScore} / 目标 ${target} · 获得 ${state.lastCoinGain || 0} 金币`;
    btnLabel = '进入商店'; btnAction = 'open-shop';
  } else {
    icon = isQuit ? '🚪' : '💔';
    title = isQuit ? `第 ${state.round} 关退出` : `第 ${state.round} 关失败`;
    desc = `累计得分 ${state.totalScore} · 到达第 ${state.round} 关`;
    btnLabel = '再来一局'; btnAction = 'restart';
    extraHtml = renderVictorySubmitSection(state, opts);
  }

  overlay.innerHTML = `
    <div class="cc-modal">
      <div class="cc-modal-icon">${icon}</div>
      <h2 class="cc-modal-title">${title}</h2>
      <p class="cc-modal-desc">${desc}</p>
      ${extraHtml}
      <button class="cc-btn cc-btn-primary" data-action="${btnAction}">${btnLabel}</button>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/** 隐藏结束界面 */
export function hideEndScreen() {
  const overlay = document.getElementById('ccOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }
}

/** 开始界面（如有 24h 内有效存档，显示"继续上次游戏"入口） */
export function renderStartScreen() {
  const stage = document.getElementById('chesterStage');
  const continueBtn = hasSave()
    ? `<button class="cc-btn cc-btn-secondary cc-btn-continue" data-action="continue-game">继续上次游戏</button>`
    : '';
  stage.innerHTML = `
    <section class="cc-start">
      <div class="cc-start-icon">🎪</div>
      <h1 class="cc-start-title">切斯特牌</h1>
      <p class="cc-start-sub">Balatro 风格扑克牌组合 · 糖果增益</p>
      <ul class="cc-start-rules">
        <li>无尽模式 · 目标分三段式增长，越后期越难</li>
        <li>每关 4 次出牌，达标进商店升级，未达标游戏结束</li>
        <li>每次最多选 5 张牌，每关 2 次弃牌</li>
        <li>得分 = (基础分 + 牌面分) × 倍率</li>
        <li>最多装备 5 颗糖果 · 可随时退出并记录分数</li>
      </ul>
      <button class="cc-btn cc-btn-primary cc-btn-start" data-action="start">开始游戏</button>
      ${continueBtn}
    </section>
  `;
}
