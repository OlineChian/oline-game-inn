/**
 * 切斯特牌 - 会话操作模块（wave 选择 / 设置 / 临时存档 / 功成身退）
 *
 * 从 main.js 拆分，处理非游戏核心循环的会话级操作：
 *   - wave 换副节点选择（继续挑战 / 现在结束）
 *   - 设置面板开关 + 临时存档 + 功成身退（含二次确认）
 *   - 糖果面板开关（移动端侧滑）
 *   - 继续上次游戏
 *
 * 工厂模式注入 State/CONFIG/renderAll/helpers，与 shop-actions.js 风格一致。
 */

import { renderSettings, renderConfirmRetire, renderWaveChoice } from '../ui/panel-render.js';
import { hideEndScreen } from '../ui/render.js';
import { saveGame, loadGame, clearSave } from './save-system.js';
import { getCandyById } from '../data/candies.js';

/**
 * 创建会话操作集合
 * @param {Object} state 游戏 State
 * @param {Object} config CONFIG
 * @param {Function} renderAll 全量渲染函数
 * @param {Object} helpers { startRound, renderGame, quitGame }
 * @returns {Object} 会话回调集合
 */
export function createSessionActions(state, config, renderAll, helpers) {
  const { startRound, renderGame, quitGame } = helpers;

  /** 继续上次游戏（从 localStorage 临时存档恢复） */
  function continueGame() {
    const saved = loadGame();
    if (!saved) return;
    const s = saved.state;
    state.round = s.round;
    state.totalScore = s.totalScore;
    state.coins = s.coins;
    state.candies = (s.candies || []).map(id => getCandyById(id)).filter(Boolean);
    state.handLevels = s.handLevels || {};
    state.shopLevel = s.shopLevel || 1;
    state.phase = 'idle';
    clearSave();  // 读档后清除存档，避免重复使用
    renderGame(config);
    startRound();
  }

  /** 打开设置面板（暂停游戏） */
  function openSettings() {
    if (state.phase !== 'playing') return;
    state._preSettingsPhase = state.phase;
    state.phase = 'settings';
    renderSettings(state, config);
  }

  /** 关闭设置面板（恢复游戏） */
  function closeSettings() {
    state.phase = state._preSettingsPhase || 'playing';
    state._preSettingsPhase = null;
    const overlay = document.getElementById('ccSettingsOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  /** 切换糖果面板显隐（仅移动端生效，电脑端侧栏常驻）
   *  同步管理遮罩、hidden 与 is-open：
   *    开启时：移除 mask/panel 的 hidden，reflow 后加 is-open 触发滑入
   *    关闭时：移除 is-open 触发滑出，动画结束后加 mask/panel 的 hidden
   */
  function toggleCandyPanel() {
    const panel = document.getElementById('ccCandyPanel');
    const mask = document.getElementById('ccCandyMask');
    if (!panel) return;
    if (panel.classList.contains('is-open')) {
      panel.classList.remove('is-open');
      if (mask) mask.classList.add('hidden');
      setTimeout(() => panel.classList.add('hidden'), 200);
    } else {
      panel.classList.remove('hidden');
      if (mask) mask.classList.remove('hidden');
      void panel.offsetWidth;  // 强制 reflow，确保 transition 生效
      panel.classList.add('is-open');
    }
  }

  /** 临时存档（24h 有效） */
  function tempSave() {
    saveGame(state);
    const hint = document.getElementById('ccSaveHint');
    if (hint) hint.textContent = '已保存（24 小时内有效）';
  }

  /** 功成身退：显示二次确认弹窗 */
  function retire() {
    state._preRetirePhase = state.phase;
    state.phase = 'confirmRetire';
    renderConfirmRetire();
  }

  /** 取消功成身退：返回设置面板 */
  function cancelRetire() {
    state.phase = state._preRetirePhase || 'settings';
    state._preRetirePhase = null;
    hideEndScreen();
    renderSettings(state, config);
  }

  /** 确认功成身退：走 quitGame 流程（提交排行榜 + 结算） */
  async function confirmRetire() {
    hideEndScreen();
    state._preRetirePhase = null;
    await quitGame();
  }

  /** wave 换副选择：继续挑战 → 进入下一关（副数由 startRound 自动通过 getDeckCount 计算） */
  function continueWave() {
    hideEndScreen();
    state.round++;
    startRound();
  }

  /** wave 换副选择：现在结束 → 走 quitGame 流程 */
  async function endWave() {
    hideEndScreen();
    await quitGame();
  }

  return {
    onContinueGame: continueGame,
    onOpenSettings: openSettings,
    onCloseSettings: closeSettings,
    onToggleCandyPanel: toggleCandyPanel,
    onTempSave: tempSave,
    onRetire: retire,
    onConfirmRetire: confirmRetire,
    onCancelRetire: cancelRetire,
    onContinueWave: continueWave,
    onEndWave: endWave
  };
}
