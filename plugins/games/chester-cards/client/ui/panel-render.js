/**
 * 切斯特牌 - 面板渲染模块
 *
 * 包含：
 *   - 糖果查看面板（移动端侧滑 + 电脑端常驻侧栏，共用同一内容）
 *   - 设置面板（暂停游戏 + 当前分数 + 计算规则 + 临时存档 + 功成身退）
 *   - 功成身退二次确认弹窗
 *   - wave 换副选择弹窗
 *
 * 纯 DOM 渲染，状态由 main.js 推送；样式由 panels.css 承载。
 */

/**
 * 渲染糖果面板内容（同步写入移动端侧滑面板与电脑端常驻侧栏）
 * @param {Object} state 游戏 State
 * @param {Object} config CONFIG
 */
export function renderCandyPanel(state, config) {
  const html = `
    <div class="cc-panel-coins">
      <span class="cc-panel-coin-label">金币</span>
      <span class="cc-panel-coin-value">${state.coins}</span>
    </div>
    <div class="cc-panel-candies">
      ${state.candies.length === 0
        ? '<div class="cc-panel-empty">尚未装备糖果</div>'
        : state.candies.map(c => `
          <div class="cc-panel-candy cc-rarity-${c.rarity}">
            <div class="cc-panel-candy-emoji">${c.emoji}</div>
            <div class="cc-panel-candy-info">
              <div class="cc-panel-candy-name">${c.name}</div>
              <div class="cc-panel-candy-desc">${c.desc}</div>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;
  const panel = document.getElementById('ccCandyPanel');
  const sidebar = document.getElementById('ccCandySidebar');
  if (panel) panel.innerHTML = html;
  if (sidebar) sidebar.innerHTML = html;
}

/**
 * 渲染设置面板（暂停游戏）
 * @param {Object} state 游戏 State
 * @param {Object} config CONFIG
 */
export function renderSettings(state, config) {
  const overlay = document.getElementById('ccSettingsOverlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="cc-settings-modal">
      <button class="cc-settings-close" data-action="close-settings" aria-label="关闭">×</button>
      <h2 class="cc-settings-title">游戏已暂停</h2>
      <div class="cc-settings-stats">
        <div class="cc-stat-row"><span class="cc-stat-label">关卡</span><span class="cc-stat-value">第 ${state.round} 关</span></div>
        <div class="cc-stat-row"><span class="cc-stat-label">本关得分</span><span class="cc-stat-value">${state.roundScore}</span></div>
        <div class="cc-stat-row"><span class="cc-stat-label">累计得分</span><span class="cc-stat-value">${state.totalScore}</span></div>
        <div class="cc-stat-row"><span class="cc-stat-label">金币</span><span class="cc-stat-value">${state.coins}</span></div>
      </div>
      <details class="cc-settings-rules">
        <summary>分数计算规则</summary>
        <ul>
          <li>本关得分 = 本关所有出牌得分之和</li>
          <li>出牌得分 = (基础筹码 + 牌面筹码) × 倍率</li>
          <li>基础筹码与倍率由牌型决定（高牌/对子/两对/三条/顺子/同花/葫芦/四条/同花顺/皇家同花顺）</li>
          <li>牌面筹码：A=11，J/Q/K=10，2-10 按面值</li>
          <li>糖果可叠加 +筹码 / ×倍率 / 机会触发等效果</li>
          <li>牌型升级可永久 +筹码 +倍率</li>
          <li>目标分随关卡递增，达标进商店，未达标游戏结束</li>
        </ul>
      </details>
      <div class="cc-settings-actions">
        <button class="cc-btn cc-btn-save" data-action="temp-save">临时存档</button>
        <button class="cc-btn cc-btn-retire" data-action="retire">功成身退</button>
      </div>
      <p class="cc-settings-hint" id="ccSaveHint"></p>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/**
 * 渲染功成身退二次确认弹窗（复用 #ccOverlay）
 */
export function renderConfirmRetire() {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="cc-modal cc-confirm-modal">
      <h2 class="cc-modal-title">确认功成身退？</h2>
      <p class="cc-modal-desc">将结算当前成绩并退出，无法继续本局。</p>
      <div class="cc-confirm-actions">
        <button class="cc-btn" data-action="cancel-retire">取消</button>
        <button class="cc-btn cc-btn-primary cc-btn-danger" data-action="confirm-retire">确认退出</button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
}

/**
 * 渲染 wave 换副选择弹窗（复用 #ccOverlay）
 * @param {number} nextRound 下一关关卡数
 * @param {number} deckCount 下一关的副数
 */
export function renderWaveChoice(nextRound, deckCount) {
  const overlay = document.getElementById('ccOverlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="cc-modal cc-wave-modal">
      <div class="cc-modal-icon">牌库升级</div>
      <h2 class="cc-modal-title">第 ${nextRound} 关</h2>
      <p class="cc-modal-desc">继续挑战将启用 ${deckCount} 副牌（共 ${deckCount * 52} 张），出牌与弃牌上限提升。</p>
      <div class="cc-wave-actions">
        <button class="cc-btn" data-action="end-wave">现在结束</button>
        <button class="cc-btn cc-btn-primary" data-action="continue-wave">继续挑战 →</button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
}
