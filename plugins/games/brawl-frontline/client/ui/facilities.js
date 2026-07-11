/**
 * C 类炮塔 UI：点击 canvas 建造位弹出对应弹窗
 * - 点击空建造位 → 建造弹窗（4 种炮塔 + 实时数值预览）
 * - 点击已建造位 → 回收弹窗（半价退款 + 当前数值）
 * - 所有弹窗打开时暂停游戏，关闭时恢复
 * - 回收等级（facilityTier）影响后续建造价格与属性
 */
import { Game, LAYOUT, VIEW } from '../core/game.js';
import { FACILITIES } from '../data/facilities.js';
import { ModalManager } from './modal-manager.js';

export const Facilities = {
  init() {
    const canvas = document.getElementById('bf-canvas');
    if (!canvas) return;
    canvas.addEventListener('click', (e) => this._onCanvasClick(e));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.bf-facility-modal') && !e.target.closest('#bf-canvas')) {
        this._closeModal();
      }
    });
  },

  /** canvas 点击 → 逻辑坐标 → 检测建造位（空位建造/已占位回收） */
  _onCanvasClick(e) {
    if (Game.state.phase !== 'wave') return;
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * VIEW.w;
    const y = (e.clientY - rect.top) / rect.height * VIEW.h;
    LAYOUT.facilitySlots.forEach((slot, i) => {
      const dx = x - slot.x, dy = y - slot.y;
      if (dx * dx + dy * dy <= 900) {
        if (Game.buildings.facilities[i]) this._showRecycleModal(i);
        else this._showBuildModal(i);
      }
    });
  },

  /** 建造弹窗：展示 4 种炮塔（含 tier/数值预览），金币不足禁用 */
  _showBuildModal(slotIndex) {
    this._closeModal();
    if (!ModalManager.open('facility', { onClose: () => this._removeModal() })) return;
    const tier = Game.buildings.facilityTier || 0;
    const tierBadge = tier > 0 ? `<span class="bf-facility-tier">强化 ×${tier}</span>` : '';
    const items = Object.values(FACILITIES).map(f => {
      const p = Game.systems.facilities.getPreview(f.id);
      const can = Game.state.gold >= p.cost;
      const stats = this._renderStats(f.id, p);
      return `<button class="bf-facility-item ${can ? '' : 'disabled'}" data-fid="${f.id}" data-slot="${slotIndex}" ${can ? '' : 'disabled'}>
        <div class="bf-facility-name" style="color:${f.color}">${f.name}</div>
        <div class="bf-facility-desc">${f.desc}</div>
        ${stats}
        <div class="bf-facility-cost">💰${p.cost}</div>
      </button>`;
    }).join('');
    const html = `<div class="bf-facility-modal" id="bf-facility-modal">
      <div class="bf-facility-content">
        <div class="bf-facility-title">选择炮塔 建造位${slotIndex + 1} ${tierBadge}</div>
        <div class="bf-facility-list">${items}</div>
        <button class="bf-btn-secondary" id="bf-facility-close">取消</button>
      </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('bf-facility-modal');
    document.getElementById('bf-facility-close').addEventListener('click', () => this._closeModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) this._closeModal(); });
    modal.querySelectorAll('.bf-facility-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.fid;
        const slot = parseInt(btn.dataset.slot);
        const r = Game.systems.facilities.build(slot, fid);
        if (!r.ok) this._toast(r.msg);
        this._closeModal();
      });
    });
  },

  /** 回收弹窗：展示当前炮塔数值 + 半价退款按钮 */
  _showRecycleModal(slotIndex) {
    const f = Game.buildings.facilities[slotIndex];
    if (!f) return;
    this._closeModal();
    if (!ModalManager.open('facility', { onClose: () => this._removeModal() })) return;
    const refund = Math.floor((f.builtCost || 0) * 0.5);
    const tierBadge = f.tier > 0 ? `<span class="bf-facility-tier">强化 ×${f.tier}</span>` : '';
    const stats = this._renderBuiltStats(f);
    const html = `<div class="bf-facility-modal" id="bf-facility-modal">
      <div class="bf-facility-content">
        <div class="bf-facility-title" style="color:${f.color}">${f.name} ${tierBadge}</div>
        <div class="bf-facility-desc">建造位${slotIndex + 1} · 已建造</div>
        ${stats}
        <div class="bf-facility-recycle-info">回收返还 💰${refund}（半价）<br>下次建造价格 +20%、属性 +15%</div>
        <div class="bf-facility-recycle-btns">
          <button class="bf-btn-secondary" id="bf-facility-close">关闭</button>
          <button class="bf-facility-recycle" data-slot="${slotIndex}">回收</button>
        </div>
      </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('bf-facility-modal');
    document.getElementById('bf-facility-close').addEventListener('click', () => this._closeModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) this._closeModal(); });
    modal.querySelector('.bf-facility-recycle').addEventListener('click', (e) => {
      const slot = parseInt(e.currentTarget.dataset.slot);
      const r = Game.systems.facilities.recycle(slot);
      if (!r.ok) this._toast(r.msg);
      else this._toast(`回收成功 返还 ${r.refund} 金币`);
      this._closeModal();
    });
  },

  /** 渲染炮塔数值预览（建造弹窗用，含 buff/tier 加成） */
  _renderStats(facilityId, p) {
    const data = FACILITIES[facilityId];
    const rows = [`<div class="bf-facility-stats">`];
    rows.push(`<span class="bf-facility-stat">血量 ${p.hp}</span>`);
    if (data.type === 'attacker') {
      rows.push(`<span class="bf-facility-stat">伤害 ${p.damage}</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${p.range}</span>`);
    } else if (data.type === 'healer') {
      rows.push(`<span class="bf-facility-stat">治疗 ${p.heal}</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${p.range}</span>`);
    } else if (data.type === 'booster') {
      rows.push(`<span class="bf-facility-stat">加伤 ${p.damageBoost}%</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${p.range}</span>`);
    }
    rows.push(`</div>`);
    return rows.join('');
  },

  /** 渲染已建造炮塔的当前数值（回收弹窗用） */
  _renderBuiltStats(f) {
    const rows = [`<div class="bf-facility-stats">`];
    rows.push(`<span class="bf-facility-stat">血量 ${Math.floor(f.hp)}/${f.maxHp}</span>`);
    if (f.type === 'attacker') {
      rows.push(`<span class="bf-facility-stat">伤害 ${f.damage}</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${f.range}</span>`);
    } else if (f.type === 'healer') {
      rows.push(`<span class="bf-facility-stat">治疗 ${f.heal}</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${f.range}</span>`);
    } else if (f.type === 'booster') {
      rows.push(`<span class="bf-facility-stat">加伤 ${Math.round(f.damageBoost * 100)}%</span>`);
      rows.push(`<span class="bf-facility-stat">射程 ${f.range}</span>`);
    }
    rows.push(`</div>`);
    return rows.join('');
  },

  _closeModal() {
    this._removeModal();
    ModalManager.close('facility');
  },

  _removeModal() {
    const m = document.getElementById('bf-facility-modal');
    if (m) m.remove();
  },

  _toast(msg) {
    const el = document.getElementById('bf-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
  }
};
