/**
 * 底部英雄卡片系统（手机端友好，横向滑动）
 * 每英雄一张卡片：色条+名字+星级+血量+属性+超能+数量徽章
 * 点击弹出招募/升星按钮；全局升星同步同种类实例
 * - 宝库 6 级解锁：批量招募面板（5/10/30/50，不足招募最大可招募数）
 * - 宝库 7 级解锁：每英雄独立自动合并开关（卡片右侧）
 * - 强化选择实时影响卡牌显示的伤害/血量
 */
import { Game } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR, RARITY_COLOR } from '../data/heroes.js';
import { Unlock } from './unlock.js';
import { VaultModal } from './vault-modal.js';
import { Batch } from './batch.js';
import { Buffs } from '../systems/buffs.js';
import { Merging } from '../systems/merging.js';

/** 定位 → CSS 类名映射（同时驱动顶部色条颜色 via --role-color） */
const ROLE_CLASS = {
  '近战': 'role-melee', '射手': 'role-ranged', '坦克': 'role-tank',
  '召唤': 'role-summon', '治疗': 'role-healer'
};
const ROLE_COLOR = {
  '坦克': '#f1c40f', '射手': '#3a86ff', '召唤': '#1abc9c',
  '近战': '#e74c3c', '治疗': '#2ecc71'
};
/** 属性行 SVG 图标（伤害=剑形/射程=靶心） */
const SVG_DMG = '<svg class="bf-stat-icon" viewBox="0 0 10 10" width="8" height="8" fill="currentColor"><path d="M5 1L8 5H6V9H4V5H2Z"/></svg>';
const SVG_RANGE = '<svg class="bf-stat-icon" viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"><circle cx="5" cy="5" r="3.5"/><circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none"/></svg>';

export const Shop = {
  _els: {},
  _selectedHero: null,
  _popupBtns: {},      // 按钮元素引用 { recruit, starUp }
  _cooldown: 0,        // 操作冷却倒计时（秒）
  _cooldownBtn: null,  // 当前冷却中的按钮

  init() {
    this._els = {
      cards: document.getElementById('bf-cards'),
      popup: document.getElementById('bf-card-popup'),
      popupBtns: document.getElementById('bf-card-popup-btns'),
      vaultBtn: document.getElementById('bf-vault-btn')
    };
    this._buildCards();
    if (this._els.vaultBtn) {
      this._els.vaultBtn.addEventListener('click', () => VaultModal.show());
    }
    document.addEventListener('bf-hero-unlocked', () => this._buildCards());
    document.addEventListener('bf-vault-upgraded', () => this._buildCards());
    document.addEventListener('click', (e) => {
      if (this._selectedHero && !e.target.closest('.bf-card') && !e.target.closest('.bf-card-popup')) {
        this._closePopup();
      }
    });
  },

  /** 构建所有英雄卡片（未解锁灰显；7 级宝库解锁时右侧追加自动合并开关） */
  _buildCards() {
    const autoMergeOn = Merging.isAutoMergeUnlocked();
    const html = HEROES.map(h => {
      const roleCls = ROLE_CLASS[h.role] || 'role-default';
      const roleColor = ROLE_COLOR[h.role] || '#888';
      const rarityColor = RARITY_COLOR[h.rarity];
      const unlocked = Game.state.unlockedHeroes.includes(h.id);
      const lockCls = unlocked ? '' : ' locked';
      const atkLabel = h.percentDamage ? `${Math.round(h.percentDamage.rate * 100)}%` : h.attack;
      const toggle = autoMergeOn && unlocked
        ? `<button class="bf-auto-merge-toggle" data-hero="${h.id}" title="自动合并" aria-label="自动合并开关"><span class="bf-auto-merge-knob"></span></button>`
        : '';
      return `<div class="bf-card ${roleCls}${lockCls}" data-hero="${h.id}" style="--role-color:${roleColor};--rarity-color:${rarityColor}">
        <div class="bf-card-role-bar">${h.role}</div>
        ${toggle}
        <div class="bf-card-top"><span class="bf-card-stars">★</span><span class="bf-card-hp">${h.hp}</span></div>
        <div class="bf-card-name">${h.name}</div>
        <div class="bf-card-stats">
          <span class="bf-stat bf-stat-dmg">${SVG_DMG}<span class="bf-stat-val">${atkLabel}</span></span>
          <span class="bf-stat bf-stat-range">${SVG_RANGE}<span class="bf-stat-val">${h.range}</span></span>
        </div>
        <div class="bf-card-super locked"><div class="bf-card-super-line1">${SUPER_UNLOCK_STAR}星解锁</div><div class="bf-card-super-line2">超级技能</div></div>
        <div class="bf-card-badges">
          <span class="bf-card-badge bf-badge-7 hidden" data-badge-7></span>
          <span class="bf-card-badge bf-badge-6 hidden" data-badge-6></span>
          <span class="bf-card-badge bf-badge-5 hidden" data-badge-5></span>
        </div>
      </div>`;
    }).join('');
    this._els.cards.innerHTML = html;
    this._els.cards.querySelectorAll('.bf-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.bf-auto-merge-toggle')) return;  // 开关独立点击
        e.stopPropagation();
        this._onCardClick(card);
      });
    });
    // 绑定自动合并开关：点击切换 Game.state.autoMerge[heroId]
    this._els.cards.querySelectorAll('.bf-auto-merge-toggle').forEach(t => {
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        const heroId = t.dataset.hero;
        if (!Game.state.autoMerge) Game.state.autoMerge = {};
        Game.state.autoMerge[heroId] = !Game.state.autoMerge[heroId];
        t.classList.toggle('on', Game.state.autoMerge[heroId]);
      });
    });
  },

  _onCardClick(card) {
    const heroId = card.dataset.hero;
    if (card.classList.contains('locked')) {
      this._toast('通过星妙之路解锁');
      setTimeout(() => Unlock.show(), 400);
      return;
    }
    if (this._selectedHero === heroId) { this._closePopup(); return; }
    this._selectedHero = heroId;
    this._els.cards.querySelectorAll('.bf-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.hero === heroId);
    });
    this._buildPopup(heroId, card);
  },

  /** 构建弹层 DOM：批量面板（已解锁）+ 招募 + 升星 */
  _buildPopup(heroId, card) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return;
    const curStar = Game.systems.heroes.getStar(heroId);
    const recruitCost = data.cost.tickets || 1;
    const upgCost = curStar >= 5 ? null : STAR_UPGRADE_COST[curStar - 1];
    const batchPanel = Batch.renderPanel(heroId);
    const recruitBtn = `<button class="bf-popup-btn recruit" data-act="recruit"><span class="bf-popup-btn-label">招募</span><span class="bf-popup-btn-cost">🎫${recruitCost}</span></button>`;
    let upgBtn;
    if (upgCost === null) {
      upgBtn = `<button class="bf-popup-btn starup" disabled><span class="bf-popup-btn-label">已满星</span></button>`;
    } else {
      upgBtn = `<button class="bf-popup-btn starup" data-act="star-up"><span class="bf-popup-btn-label">升星 ${curStar}→${curStar + 1}</span><span class="bf-popup-btn-cost">💰${upgCost}</span></button>`;
    }
    this._els.popupBtns.innerHTML = batchPanel + recruitBtn + upgBtn;
    this._els.popup.classList.remove('hidden');
    this._popupBtns.recruit = this._els.popupBtns.querySelector('[data-act="recruit"]');
    this._popupBtns.starUp = this._els.popupBtns.querySelector('[data-act="star-up"]');
    if (this._popupBtns.recruit) {
      this._popupBtns.recruit.addEventListener('click', (e) => this._onAction(e, 'recruit'));
    }
    if (this._popupBtns.starUp) {
      this._popupBtns.starUp.addEventListener('click', (e) => this._onAction(e, 'star-up'));
    }
    Batch.bind(this._els.popupBtns, heroId, () => this._buildPopup(heroId, card));
    this._positionPopup(card);
    this._updatePopupState();
  },

  /** 定位弹层到卡片正上方 */
  _positionPopup(card) {
    const popup = this._els.popup;
    const rect = card.getBoundingClientRect();
    popup.style.left = '0px'; popup.style.top = '0px';
    const pw = popup.offsetWidth, ph = popup.offsetHeight;
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.top - ph - 8;
    if (left < 4) left = 4;
    if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
    if (top < 4) top = rect.bottom + 8;
    popup.style.left = `${left}px`; popup.style.top = `${top}px`;
  },

  _onAction(e, act) {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (btn.disabled || this._cooldown > 0) return;
    const heroId = this._selectedHero;
    let msg = '', ok = false;
    if (act === 'recruit') {
      ok = Game.systems.heroes.recruit(heroId);
      if (!ok) msg = '英雄券不足';
    } else if (act === 'star-up') {
      ok = Game.systems.heroes.upgradeStar(heroId);
      if (!ok) msg = '金币不足或已满星';
    }
    if (msg) this._toast(msg);
    else if (ok) {
      this._startCooldown(btn, 0.35);
      if (act === 'star-up') {
        const card = this._els.cards.querySelector(`[data-hero="${heroId}"]`);
        if (card) this._buildPopup(heroId, card);
      }
    }
  },

  _startCooldown(btn, duration) {
    this._cooldown = duration;
    this._cooldownBtn = btn;
    btn.classList.add('cooldown');
    btn.disabled = true;
  },

  _updatePopupState() {
    if (!this._selectedHero) return;
    const st = Game.state;
    const data = HEROES.find(h => h.id === this._selectedHero);
    if (!data) return;
    if (this._cooldown > 0) {
      this._cooldown -= 1 / 60;
      if (this._cooldown <= 0 && this._cooldownBtn) {
        this._cooldownBtn.classList.remove('cooldown');
        this._cooldownBtn = null;
      }
    }
    if (this._popupBtns.recruit && !this._popupBtns.recruit.classList.contains('cooldown')) {
      const cost = data.cost.tickets || 1;
      const ratio = Math.min(1, st.tickets / cost);
      this._popupBtns.recruit.style.setProperty('--progress', `${ratio * 100}%`);
      this._popupBtns.recruit.disabled = ratio < 1 || this._cooldown > 0;
    }
    if (this._popupBtns.starUp && this._popupBtns.starUp.hasAttribute('data-act') &&
        !this._popupBtns.starUp.classList.contains('cooldown')) {
      const curStar = Game.systems.heroes.getStar(this._selectedHero);
      if (curStar < 5) {
        const upgCost = STAR_UPGRADE_COST[curStar - 1];
        const ratio = Math.min(1, st.gold / upgCost);
        this._popupBtns.starUp.style.setProperty('--progress', `${ratio * 100}%`);
        this._popupBtns.starUp.disabled = ratio < 1 || this._cooldown > 0;
      }
    }
    Batch.refresh(this._selectedHero);
  },

  _closePopup() {
    this._selectedHero = null;
    this._cooldown = 0;
    this._cooldownBtn = null;
    this._els.popup.classList.add('hidden');
    this._els.cards.querySelectorAll('.bf-card').forEach(c => c.classList.remove('selected'));
  },

  /** 每帧刷新卡牌数值（含强化倍率，实时反映强化选择） + 弹层按钮状态 */
  refresh() {
    const st = Game.state;
    if (!st) return;
    const atkMult = 1 + Buffs.heroAtkRate();
    const hpMult = 1 + Buffs.heroHpRate();
    this._els.cards.querySelectorAll('.bf-card').forEach(card => {
      const heroId = card.dataset.hero;
      const data = HEROES.find(h => h.id === heroId);
      if (!data) return;
      if (card.classList.contains('locked')) return;
      const star = Game.systems.heroes.getStar(heroId);
      const m6 = star >= 7 ? 2.5 * 3.0 : (star === 6 ? 2.5 : 1);
      const hp = Math.floor(data.hp * Math.pow(STAR_GROWTH.hp, Math.min(star, 5) - 1) * m6 * hpMult);
      const atkLabel = data.percentDamage
        ? `${Math.round(data.percentDamage.rate * 100)}%`
        : Math.floor(data.attack * Math.pow(STAR_GROWTH.attack, Math.min(star, 5) - 1) * m6 * atkMult);
      card.querySelector('.bf-card-stars').textContent = star >= 6 ? `☾${star}` : '★'.repeat(star);
      card.querySelector('.bf-card-hp').textContent = hp;
      const dmgVal = card.querySelector('.bf-stat-dmg .bf-stat-val');
      const rngVal = card.querySelector('.bf-stat-range .bf-stat-val');
      if (dmgVal) dmgVal.textContent = atkLabel;
      if (rngVal) rngVal.textContent = data.range;
      const unlocked = star >= SUPER_UNLOCK_STAR;
      const superEl = card.querySelector('.bf-card-super');
      superEl.className = `bf-card-super ${unlocked ? 'unlocked' : 'locked'}`;
      const line1 = superEl.querySelector('.bf-card-super-line1');
      const line2 = superEl.querySelector('.bf-card-super-line2');
      if (unlocked) {
        line1.textContent = '超级技能';
        line2.textContent = data.super.name.replace(/^超级技能：/, '');
      } else {
        line1.textContent = `${SUPER_UNLOCK_STAR}星解锁`;
        line2.textContent = '超级技能';
      }
      const insts = Game.entities.heroes.filter(h => h.id === heroId);
      _setBadge(card, 5, insts.filter(h => h.star < 6).length);
      _setBadge(card, 6, insts.filter(h => h.star === 6).length);
      _setBadge(card, 7, insts.filter(h => h.star >= 7).length);
      const toggle = card.querySelector('.bf-auto-merge-toggle');
      if (toggle) toggle.classList.toggle('on', !!(Game.state.autoMerge && Game.state.autoMerge[heroId]));
    });
    if (this._selectedHero) {
      this._updatePopupState();
      const card = this._els.cards.querySelector(`[data-hero="${this._selectedHero}"]`);
      if (card) this._positionPopup(card);
    }
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

/** 设置卡牌右上角星级数量徽章（n=0 时隐藏，自动靠右对齐） */
function _setBadge(card, star, n) {
  const el = card.querySelector(`[data-badge-${star}]`);
  if (!el) return;
  el.textContent = n > 0 ? `×${n}` : '';
  el.classList.toggle('hidden', n === 0);
}
