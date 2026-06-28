/**
 * 英雄合并 UI：从宝库入口进入，独立浮层
 * - 顶部切换 5→6 / 6→7（未解锁灰显）
 * - 列出可合并英雄（按 id 分组，≥2 个才显示）
 * - 选择合并数量 1/3/5（9 级追加 50），不足变灰
 * - 打开时游戏暂停
 */
import { Game } from '../core/game.js';
import { Merging } from '../systems/merging.js';

export const MergingUI = {
  _type: 'star5to6',
  _heroId: null,
  _count: 1,

  show() {
    Game.state.paused = true;
    this._type = 'star5to6';
    this._heroId = null;
    this._count = 1;
    this._render();
  },

  close() {
    Game.state.paused = false;
    const m = document.getElementById('bf-merge-modal');
    if (m) m.remove();
  },

  _render() {
    this._removeOld();
    const t6 = Merging.isUnlocked('star5to6');
    const t7 = Merging.isUnlocked('star6to7');
    let html = `<div class="bf-merge-modal" id="bf-merge-modal"><div class="bf-merge-content">
      <button class="bf-modal-close" id="bf-merge-close">×</button>
      <div class="bf-modal-title">英雄合并</div>
      <div class="bf-merge-tabs">
        <button class="bf-merge-tab${this._type === 'star5to6' ? ' active' : ''}${t6 ? '' : ' locked'}" data-type="star5to6">5★ → 6★</button>
        <button class="bf-merge-tab${this._type === 'star6to7' ? ' active' : ''}${t7 ? '' : ' locked'}" data-type="star6to7">6★ → 7★</button>
      </div>`;
    if (this._type === 'star5to6' && !t6) {
      html += `<div class="bf-merge-locked-tip">宝库 6 级解锁</div>`;
    } else if (this._type === 'star6to7' && !t7) {
      html += `<div class="bf-merge-locked-tip">宝库 10 级解锁</div>`;
    } else {
      html += this._renderHeroList();
      if (this._heroId) html += this._renderCountSelector();
    }
    html += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    this._bind();
  },

  _renderHeroList() {
    const list = Merging.getMergeableHeroes(this._type);
    if (!list.length) return `<div class="bf-merge-empty">暂无可合并英雄（需 2 个相同星级）</div>`;
    let html = `<div class="bf-merge-hero-list">`;
    list.forEach(g => {
      const pairs = Math.floor(g.instances.length / 2);
      const sel = this._heroId === g.id ? ' selected' : '';
      html += `<button class="bf-merge-hero-card${sel}" data-hero="${g.id}">
        <span class="bf-merge-hero-color" style="background:${g.color}"></span>
        <span class="bf-merge-hero-name">${g.name}</span>
        <span class="bf-merge-hero-count">×${g.instances.length} (可合 ${pairs})</span>
      </button>`;
    });
    html += `</div>`;
    return html;
  },

  _renderCountSelector() {
    const counts = Merging.availableCounts(this._type, this._heroId);
    if (!counts.length) return '';
    const unitCost = Merging.unitCost(this._type);
    let html = `<div class="bf-merge-count-row"><div class="bf-merge-count-label">合并数量</div><div class="bf-merge-count-btns">`;
    counts.forEach(c => {
      const cost = unitCost * c.n;
      const goldEnough = Game.state.gold >= cost;
      const enabled = c.enabled && goldEnough;
      const sel = this._count === c.n ? ' selected' : '';
      const cls = `bf-merge-count-btn${sel}${enabled ? '' : ' disabled'}`;
      html += `<button class="${cls}" data-count="${c.n}" ${enabled ? '' : 'disabled'}>
        <span class="bf-merge-count-n">${c.n}</span>
        <span class="bf-merge-count-cost">💰${cost}</span>
      </button>`;
    });
    html += `</div></div>`;
    html += `<button class="bf-btn-primary" id="bf-merge-do">确认合并</button>`;
    return html;
  },

  _bind() {
    document.getElementById('bf-merge-close').addEventListener('click', () => this.close());
    const modal = document.getElementById('bf-merge-modal');
    modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });
    modal.querySelectorAll('.bf-merge-tab').forEach(t => {
      t.addEventListener('click', () => {
        if (t.classList.contains('locked')) return;
        this._type = t.dataset.type;
        this._heroId = null;
        this._count = 1;
        this._render();
      });
    });
    modal.querySelectorAll('.bf-merge-hero-card').forEach(c => {
      c.addEventListener('click', () => {
        this._heroId = c.dataset.hero;
        this._count = 1;
        this._render();
      });
    });
    modal.querySelectorAll('.bf-merge-count-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (b.classList.contains('disabled')) return;
        this._count = parseInt(b.dataset.count, 10);
        this._render();
      });
    });
    const doBtn = document.getElementById('bf-merge-do');
    if (doBtn) {
      doBtn.addEventListener('click', () => {
        const r = Merging.merge(this._type, this._heroId, this._count);
        if (!r.ok) {
          this._toast(r.msg);
          return;
        }
        this._toast(`合并成功：产出 ${r.produced} 个，花费 ${r.cost} 金币`);
        this._heroId = null;
        this._count = 1;
        this._render();
      });
    }
  },

  _toast(msg) {
    const t = document.getElementById('bf-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  },

  _removeOld() {
    const old = document.getElementById('bf-merge-modal');
    if (old) old.remove();
  }
};
