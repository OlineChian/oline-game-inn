/**
 * 批量招募面板（宝库 6 级解锁）
 * - 在卡片弹层招募/升星按钮上方展示
 * - 4 档批量：5 / 10 / 30 / 50
 * - 不足时招募最大可招募数
 */
import { Game } from '../core/game.js';
import { HEROES } from '../data/heroes.js';

const BATCH_OPTIONS = [5, 10, 30, 50];

export const Batch = {
  /** 宝库 6 级（英雄合并解锁）后开放批量招募 */
  isUnlocked() {
    return Game.buildings.vault.level >= 6;
  },

  /** 渲染批量招募面板（未解锁返回空串） */
  renderPanel(heroId) {
    if (!this.isUnlocked()) return '';
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return '';
    const cost = data.cost.tickets || 1;
    const btns = BATCH_OPTIONS.map(n => {
      const total = cost * n;
      return `<button class="bf-batch-btn" data-batch="${n}"><span class="bf-batch-n">×${n}</span><span class="bf-batch-cost">🎫${total}</span></button>`;
    }).join('');
    return `<div class="bf-batch-panel"><span class="bf-batch-label">批量招募</span><div class="bf-batch-btns">${btns}</div></div>`;
  },

  /** 绑定批量按钮：点击招募 min(n, 可招募最大值) */
  bind(container, heroId, onDone) {
    if (!this.isUnlocked()) return;
    container.querySelectorAll('.bf-batch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const n = parseInt(btn.dataset.batch, 10);
        const got = this.recruit(heroId, n);
        if (got > 0) { if (onDone) onDone(); this._toast(`招募 ${got} 个英雄`); }
        else this._toast('英雄券不足');
      });
    });
  },

  /** 批量招募：不足时招募最大可招募数 */
  recruit(heroId, count) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return 0;
    const cost = data.cost.tickets || 1;
    const max = Math.floor(Game.state.tickets / cost);
    const n = Math.min(count, max);
    for (let i = 0; i < n; i++) Game.systems.heroes.recruit(heroId);
    return n;
  },

  /** 刷新批量按钮可用状态（券不足 1 个时禁用） */
  refresh(heroId) {
    if (!this.isUnlocked()) return;
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return;
    const max = Math.floor(Game.state.tickets / (data.cost.tickets || 1));
    document.querySelectorAll('.bf-batch-btn').forEach(btn => {
      btn.classList.toggle('disabled', max === 0);
      btn.disabled = max === 0;
    });
  },

  _toast(msg) {
    const el = document.getElementById('bf-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('show'), 1500);
  }
};
