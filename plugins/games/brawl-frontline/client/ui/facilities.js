/**
 * C 类设施购买 UI：点击 canvas 建造位弹出设施选择弹窗
 * - 仅 wave 阶段可操作
 * - 点击空建造位 → 弹出 4 种设施选择
 * - 金币不足时按钮禁用
 */
import { Game, LAYOUT, VIEW } from '../core/game.js';
import { FACILITIES } from '../data/facilities.js';

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

  /** canvas 点击 → 逻辑坐标 → 检测建造位 */
  _onCanvasClick(e) {
    if (Game.state.phase !== 'wave') return;
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * VIEW.w;
    const y = (e.clientY - rect.top) / rect.height * VIEW.h;
    LAYOUT.facilitySlots.forEach((slot, i) => {
      const dx = x - slot.x, dy = y - slot.y;
      if (dx * dx + dy * dy <= 900 && !Game.buildings.facilities[i]) {
        this._showBuildModal(i);
      }
    });
  },

  _showBuildModal(slotIndex) {
    this._closeModal();
    const items = Object.values(FACILITIES).map(f => {
      const can = Game.state.gold >= f.cost;
      return `<button class="bf-facility-item ${can ? '' : 'disabled'}" data-fid="${f.id}" data-slot="${slotIndex}">
        <div class="bf-facility-name" style="color:${f.color}">${f.name}</div>
        <div class="bf-facility-desc">${f.desc}</div>
        <div class="bf-facility-cost">${f.cost}金币</div>
      </button>`;
    }).join('');
    const html = `<div class="bf-facility-modal" id="bf-facility-modal">
      <div class="bf-facility-content">
        <div class="bf-facility-title">选择设施 建造位${slotIndex + 1}</div>
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

  _closeModal() {
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
