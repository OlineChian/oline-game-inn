/**
 * 切斯特牌 - 渲染模块
 * 阶段 2：含糖果槽渲染与得分动效触发列表
 * 阶段 6：实时分数预览（选牌时显示牌型与分数）
 * 纯 DOM 操作，状态由 main.js 推送
 */

import { scoreHand } from '../core/scoring.js';
import { previewCandiesToScore } from '../systems/candy-system.js';
import { renderVictorySubmitSection } from './submit-section.js';

/** 主入口容器渲染（仅首次，需 config 渲染关卡总数） */
export function renderGame(config) {
  const stage = document.getElementById('chesterStage');
  stage.innerHTML = `
    <header class="cc-hud">
      <div class="cc-hud-row cc-hud-row-single">
        <div class="cc-hud-pill cc-pill-round">
          <span class="cc-hud-label">关卡</span>
          <span class="cc-round-num">
            <span class="cc-round-current" id="ccRoundCurrent">1</span><span class="cc-round-total">/${config.rounds}</span>
          </span>
        </div>
        <div class="cc-hud-pill cc-pill-target">
          <span class="cc-hud-label">目标分</span>
          <span class="cc-target-num"><span id="ccRoundScore">0</span><span class="cc-target-sep">/</span><span id="ccTarget">300</span></span>
        </div>
        <div class="cc-hud-pill cc-pill-play">
          <span class="cc-hud-label">出牌</span>
          <span class="cc-hud-value"><span id="ccPlays">4</span><span class="cc-hud-div">/</span><span id="ccPlaysMax">4</span></span>
        </div>
        <div class="cc-hud-pill cc-pill-discard">
          <span class="cc-hud-label">弃牌</span>
          <span class="cc-hud-value"><span id="ccDiscards">2</span><span class="cc-hud-div">/</span><span id="ccDiscardsMax">2</span></span>
        </div>
      </div>
    </header>

    <section class="cc-candy-row">
      <div class="cc-coin-box">
        <span class="cc-coin-label">💰 金币</span>
        <span class="cc-coin-value" id="ccCoins">0</span>
      </div>
      <div class="cc-candies" id="ccCandies"></div>
    </section>

    <div class="cc-preview hidden" id="ccPreview"></div>

    <section class="cc-table" id="ccTable">
      <div class="cc-hand" id="ccHand"></div>
      <div class="cc-actions">
        <button class="cc-btn cc-btn-play" data-action="play">
          <span class="cc-btn-count" id="ccSelCount">0/${config.maxPlay}</span>
          <span class="cc-btn-label">出牌</span>
        </button>
        <button class="cc-btn cc-btn-discard" data-action="discard">
          <span class="cc-btn-count" id="ccDiscLeft">2/${config.discardsPerRound}</span>
          <span class="cc-btn-label">弃牌</span>
        </button>
        <button class="cc-btn cc-btn-restart" data-action="restart">重新开始</button>
      </div>
    </section>

    <div class="cc-score-popup hidden" id="ccPopup"></div>
    <div class="cc-overlay hidden" id="ccOverlay"></div>
  `;
}

/** 实时分数预览（选牌时显示当前牌型与分数）
 * 依据 state.selected 实时计算牌型与分数（应用糖果效果）
 * mult_chance 类型糖果不实际掷骰子，仅标记「机会加成」
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
  const baseResult = scoreHand(played, state.handLevels || {});
  if (!baseResult.handType) {
    previewEl.innerHTML = `<div class="cc-preview-hint">无效牌组</div>`;
    return;
  }
  const result = previewCandiesToScore(baseResult, state.candies);
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
        ${normalTriggers.map(t => `<span class="cc-preview-trigger">${t.candy.emoji} ${t.msg}</span>`).join('')}
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

/** 渲染糖果槽（已填充：点击翻面看效果；空槽：占位） */
export function renderCandies(state, config) {
  const candiesEl = document.getElementById('ccCandies');
  if (!candiesEl) return;
  const slots = [];
  for (let i = 0; i < config.maxCandies; i++) {
    const candy = state.candies[i];
    if (candy) {
      slots.push(`
        <div class="cc-candy-slot has-candy cc-rarity-${candy.rarity}" data-slot="${i}">
          <div class="cc-candy-inner">
            <div class="cc-candy-face cc-candy-front">
              <div class="cc-candy-emoji">${candy.emoji}</div>
              <div class="cc-candy-name">${candy.name}</div>
            </div>
            <div class="cc-candy-face cc-candy-back">${candy.desc}</div>
          </div>
        </div>
      `);
    } else {
      slots.push(`
        <div class="cc-candy-slot" data-slot="${i}">
          <div class="cc-candy-emoji">＋</div>
          <div class="cc-candy-name">空槽</div>
        </div>
      `);
    }
  }
  candiesEl.innerHTML = slots.join('');
}

/** 渲染 HUD（单行四胶囊，无进度条） */
export function renderHUD(state, config) {
  const target = config.targets[state.round - 1] || 0;
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('ccRoundCurrent', state.round);
  setText('ccRoundScore', state.roundScore);
  setText('ccTarget', target);
  setText('ccCoins', state.coins);
  setText('ccPlays', state.playsLeft);
  setText('ccPlaysMax', config.playsPerRound);
  setText('ccDiscards', state.discardsLeft);
  setText('ccDiscardsMax', config.discardsPerRound);
  setText('ccSelCount', `${state.selected.size}/${config.maxPlay}`);
  setText('ccDiscLeft', `${state.discardsLeft}/${config.discardsPerRound}`);

  const playBtn = document.querySelector('.cc-btn-play');
  const discardBtn = document.querySelector('.cc-btn-discard');
  if (playBtn) playBtn.disabled = state.selected.size === 0 || state.playsLeft <= 0;
  if (discardBtn) discardBtn.disabled = state.selected.size === 0 || state.discardsLeft <= 0;
}

/** 得分动效（含糖果触发列表） */
export function showScorePopup(result) {
  const popup = document.getElementById('ccPopup');
  if (!popup) return;
  const triggers = result.triggered && result.triggered.length > 0
    ? `<div class="cc-popup-triggers">
        ${result.triggered.map(t => `<span class="cc-popup-trigger">${t.candy.emoji} ${t.msg}</span>`).join('')}
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

/** 结束界面（胜利/失败/通关）
 * 阶段 3：移除免费糖果奖励文案，改为金币结算 + 进入商店按钮
 * 阶段 7：胜利时显示分数提交 UI（昵称输入 + 提交按钮）
 * state.lastCoinGain 由 main.js 在 endRound 中写入
 * opts.submitState: undefined | 'submitting' | 'success' | 'fail'
 */
export function renderEndScreen(state, config, opts = {}) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  const target = config.targets[state.round - 1] || 0;
  const isVictory = state.phase === 'victory';
  const isRoundWin = state.phase === 'roundWin';
  const isLose = state.phase === 'roundLose';

  let title, desc, btnLabel, btnAction;
  let extraHtml = '';
  if (isVictory) {
    title = '🏆 通关！';
    desc = `8 关全部完成！累计得分 ${state.totalScore}，金币 ${state.coins}`;
    btnLabel = '再来一局';
    btnAction = 'restart';
    extraHtml = renderVictorySubmitSection(state, opts);
  } else if (isRoundWin) {
    const gain = state.lastCoinGain || 0;
    title = `🎉 第 ${state.round} 关完成`;
    desc = `本关 ${state.roundScore} / 目标 ${target} · 获得 ${gain} 金币`;
    btnLabel = '进入商店';
    btnAction = 'open-shop';
  } else if (isLose) {
    title = '💔 本关失败';
    desc = `本关 ${state.roundScore} / 目标 ${target}，差 ${target - state.roundScore} 分`;
    btnLabel = '重新开始';
    btnAction = 'restart';
  } else {
    overlay.classList.add('hidden');
    return;
  }

  overlay.innerHTML = `
    <div class="cc-modal">
      <div class="cc-modal-icon">${isVictory ? '🏆' : (isLose ? '💔' : '🎉')}</div>
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

/** 开始界面 */
export function renderStartScreen() {
  const stage = document.getElementById('chesterStage');
  stage.innerHTML = `
    <section class="cc-start">
      <div class="cc-start-icon">🎪</div>
      <h1 class="cc-start-title">切斯特牌</h1>
      <p class="cc-start-sub">Balatro 风格扑克牌组合 · 糖果增益</p>
      <ul class="cc-start-rules">
        <li>每关 4 次出牌机会，目标分达标进入下一关</li>
        <li>每次最多选 5 张牌，每关 2 次弃牌</li>
        <li>得分 = (基础分 + 牌面分) × 倍率</li>
        <li>每关胜利获得 1 张糖果，最多 5 张同时生效</li>
        <li>共 8 关，目标分数逐关递增</li>
      </ul>
      <button class="cc-btn cc-btn-primary cc-btn-start" data-action="start">开始游戏</button>
    </section>
  `;
}
