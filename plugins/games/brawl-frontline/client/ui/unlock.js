/**
 * 英雄解锁界面（3 候选选 1）
 * - 点击 HUD 解锁按钮 → 生成候选池 → 横排展示 3 张英雄卡
 * - 卡片样式与 shop 卡片几乎一致（定位色条 + 稀有度描边）
 * - 卡片下方显示价格和解锁按钮
 * - 关闭按钮位于右上角
 * - 选择后消耗英雄券解锁，通过事件总线通知 shop 重建卡片
 */
import { Game } from '../core/game.js';
import { RARITY_LABEL, RARITY_COLOR, UNLOCK_COST } from '../data/heroes.js';
import { Heroes } from '../systems/heroes.js';

/** 定位 → 顶部色条颜色（与 shop.js 一致） */
const ROLE_COLOR = {
  '坦克': '#f1c40f',
  '射手': '#3a86ff',
  '召唤': '#1abc9c',
  '近战': '#e74c3c',
  '治疗': '#2ecc71'
};

export const Unlock = {
  /** 显示解锁弹窗（暂停游戏） */
  show() {
    Game.state.paused = true;
    const choices = Heroes.generateUnlockChoices();
    const body = document.getElementById('bf-modal-body');
    if (choices.length === 0) {
      body.innerHTML = this._wrapShell(
        '<div class="bf-unlock-empty">所有英雄已解锁！</div>'
      );
      document.getElementById('bf-modal').classList.remove('hidden');
      document.getElementById('bf-unlock-close').addEventListener('click', () => this.close());
      return;
    }
    const cardsHtml = choices.map(h => this._renderCard(h)).join('');
    const html = this._wrapShell(
      `<div class="bf-unlock-tickets">持有英雄券：<b>${Math.floor(Game.state.tickets)}</b></div>` +
      `<div class="bf-unlock-grid">${cardsHtml}</div>`
    );
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    body.querySelectorAll('.bf-unlock-card').forEach(card => {
      const btn = card.querySelector('.bf-unlock-card-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.classList.contains('disabled')) { this._toast('英雄券不足'); return; }
          this._onUnlock(card.dataset.hero);
        });
      }
    });
    document.getElementById('bf-unlock-close').addEventListener('click', () => this.close());
  },

  /** 弹窗外壳：标题 + 右上角关闭按钮 + 主体内容 */
  _wrapShell(inner) {
    return '<button class="bf-unlock-close-btn" id="bf-unlock-close" aria-label="关闭">×</button>' +
      '<div class="bf-unlock-title">英雄解锁（3选1）</div>' +
      inner;
  },

  /** 渲染单张解锁卡片（与 shop 卡片几乎一致 + 价格/解锁按钮） */
  _renderCard(h) {
    const roleColor = ROLE_COLOR[h.role] || '#888';
    const rarityColor = RARITY_COLOR[h.rarity];
    const cost = UNLOCK_COST[h.rarity];
    const canAfford = Game.state.tickets >= cost;
    const roleCls = 'role-' + ({ '坦克': 'tank', '射手': 'ranged', '召唤': 'summon', '近战': 'melee', '治疗': 'healer' }[h.role] || 'default');
    return `<div class="bf-card ${roleCls} bf-unlock-card ${canAfford ? '' : 'disabled'}" data-hero="${h.id}" style="--role-color:${roleColor};--rarity-color:${rarityColor}">
      <div class="bf-card-role-bar">${h.role}</div>
      <div class="bf-card-top">
        <span class="bf-card-stars">★</span>
        <span class="bf-card-hp">血量 ${h.hp}</span>
      </div>
      <div class="bf-card-name">${h.name}</div>
      <div class="bf-card-stats">
        <div class="bf-card-stat-line">伤害 ${h.attack}</div>
        <div class="bf-card-stat-line">射程 ${h.range}</div>
      </div>
      <div class="bf-card-super">${h.super.name}</div>
      <div class="bf-unlock-card-footer">
        <div class="bf-unlock-rarity-tag" style="color:${rarityColor}">${RARITY_LABEL[h.rarity]}</div>
        <div class="bf-unlock-cost ${canAfford ? '' : 'insufficient'}">🎫 ${cost}</div>
        <button class="bf-unlock-card-btn ${canAfford ? '' : 'disabled'}" ${canAfford ? '' : 'disabled'}>解锁</button>
      </div>
    </div>`;
  },

  _onUnlock(heroId) {
    const r = Heroes.unlock(heroId);
    if (!r.ok) { this._toast(r.msg || '解锁失败'); return; }
    this.close();
    // 通知 shop 重建卡片（通过自定义事件，避免循环依赖）
    document.dispatchEvent(new CustomEvent('bf-hero-unlocked', { detail: { heroId } }));
    this._toast(`已解锁：${r.hero.name}（${RARITY_LABEL[r.hero.rarity]}）`);
  },

  close() {
    document.getElementById('bf-modal').classList.add('hidden');
    Game.state.paused = false;
  },

  _toast(msg) {
    const el = document.getElementById('bf-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
};
