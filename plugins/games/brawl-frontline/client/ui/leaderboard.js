/**
 * 排行榜集成：签名提交 + 弹窗展示
 * 复用全局 /score-signer.js（window.ScoreSigner）和 /api/leaderboard/brawl-frontline
 */
import { Game } from '../core/game.js';
import { fmtNum } from '../core/utils.js';

const GAME_ID = 'brawl-frontline';

export const Leaderboard = {
  /** 显示排行榜弹窗 */
  show() {
    document.getElementById('bf-lb-modal').classList.remove('hidden');
    this.load();
  },

  close() {
    document.getElementById('bf-lb-modal').classList.add('hidden');
  },

  async load() {
    const list = document.getElementById('bf-lb-list');
    list.innerHTML = '<div class="bf-lb-loading">加载中...</div>';
    try {
      const res = await fetch(`/api/leaderboard/${GAME_ID}`);
      const data = await res.json();
      if (data.success && data.leaderboard.length > 0) {
        list.innerHTML = data.leaderboard.map((item, i) => `
          <div class="bf-lb-item">
            <div class="bf-lb-rank ${i < 3 ? 'rank-' + (i + 1) : 'rank-other'}">${i + 1}</div>
            <div class="bf-lb-name">${this._esc(item.nickname)}</div>
            <div class="bf-lb-score">${fmtNum(item.score)}<span class="bf-lb-unit">${data.config.unit}</span></div>
          </div>
        `).join('');
      } else {
        list.innerHTML = `
          <div class="bf-lb-empty">
            <div class="bf-lb-empty-icon">🎯</div>
            <p>暂无排行记录</p>
            <p class="bf-lb-empty-tip">快去挑战成为第一名吧！</p>
          </div>`;
      }
    } catch (e) {
      list.innerHTML = '<div class="bf-lb-loading">加载失败</div>';
    }
  },

  /** 提交成绩（带签名） */
  async submit(score, extra = {}) {
    const nickname = localStorage.getItem('gameNickname');
    if (!nickname || !nickname.trim()) {
      console.log('[BF] 未设置昵称，跳过成绩提交');
      return null;
    }
    if (!window.ScoreSigner) {
      console.log('[BF] ScoreSigner 未加载，跳过成绩提交');
      return null;
    }
    try {
      const sig = await window.ScoreSigner.sign({ gameId: GAME_ID, nickname, score });
      const res = await fetch(`/api/leaderboard/${GAME_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname, score, extra,
          timestamp: sig.timestamp, nonce: sig.nonce, signature: sig.signature
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log(`[BF] 成绩提交成功，排名 ${data.rank}/${data.total}`);
      }
      return data;
    } catch (e) {
      console.log('[BF] 提交成绩失败:', e);
      return null;
    }
  },

  _esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
