/**
 * 切斯特牌 - 排行榜提交模块
 * 从 main.js 拆分以遵守单文件 ≤300 行铁律
 * 负责：HMAC 签名 → POST /api/leaderboard/chester-cards → 回写 UI 状态
 *
 * 提交时机：
 *   1. endRound 失败时（未达标游戏结束）
 *   2. quitGame 退出时（玩家主动退出，记录当前分数）
 *   3. 用户在结算界面手动重新提交
 */

import { renderEndScreen } from './ui/render.js';

/**
 * 提交分数到服务器
 * @param {object} state - 游戏状态（读取 totalScore/round/candies/coins/handLevels）
 * @param {string} nickname - 玩家昵称
 * @returns {Promise<boolean>} 是否提交成功
 */
export async function submitScoreToLeaderboard(state, nickname) {
  if (!nickname || !nickname.trim()) return false;
  if (!window.ScoreSigner) {
    console.warn('[chester] ScoreSigner 未加载，跳过成绩提交');
    return false;
  }
  try {
    const sig = await window.ScoreSigner.sign({
      gameId: 'chester-cards',
      nickname,
      score: state.totalScore
    });
    const response = await fetch('/api/leaderboard/chester-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score: state.totalScore,
        extra: {
          round: state.round,
          candies: state.candies.length,
          coins: state.coins,
          handLevels: state.handLevels
        },
        timestamp: sig.timestamp,
        nonce: sig.nonce,
        signature: sig.signature
      })
    });
    const data = await response.json();
    if (!data.success) {
      console.warn('[chester] 成绩提交失败:', data.error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[chester] 排行榜提交失败:', e);
    return false;
  }
}

/**
 * 提交分数并刷新结算界面 UI
 * @param {object} state - 游戏状态
 * @param {object} config - 游戏配置
 * @param {string} nickname - 玩家昵称
 */
export async function submitAndRefresh(state, config, nickname) {
  renderEndScreen(state, config, { submitState: 'submitting' });
  const ok = await submitScoreToLeaderboard(state, nickname);
  renderEndScreen(state, config, { submitState: ok ? 'success' : 'fail' });
}

/**
 * 用户在结算界面点击"提交成绩"按钮
 * 读取输入框昵称 → 存 localStorage → 提交 → 刷新 UI
 * @param {object} state - 游戏状态
 * @param {object} config - 游戏配置
 */
export async function submitWithNickname(state, config) {
  const input = document.getElementById('ccNicknameInput');
  if (!input) return;
  const nickname = input.value.trim();
  if (!nickname) return;
  localStorage.setItem('gameNickname', nickname);
  await submitAndRefresh(state, config, nickname);
}
