/**
 * 底部英雄卡片系统（手机端友好，横向滑动）
 * - 每个英雄种类一张卡片：英雄色顶条 + 大名字 + 左上星级 + 右上血量 + 属性 + 超能状态
 * - 卡片背景按定位装饰：近战=斜线/射手=靶心/坦克=盾形/召唤=齿轮
 * - 点击卡片选中，弹出招募/升星按钮（并排各占一半，不足时变灰+冷却提示）
 * - 全局升星：升星后所有同种类英雄与新招募英雄都带新星级
 * - 弹层只构建一次 DOM，每帧仅更新 disabled 状态（避免点击丢失）
 */
import { Game } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR } from '../data/heroes.js';

/** 定位 → CSS 类名映射 */
const ROLE_CLASS = {
  '近战': 'role-melee',
  '射手': 'role-ranged',
  '坦克': 'role-tank',
  '召唤': 'role-summon'
};

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
      this._els.vaultBtn.addEventListener('click', () => this._showVaultModal());
    }
    // 点击空白处关闭弹层
    document.addEventListener('click', (e) => {
      if (this._selectedHero && !e.target.closest('.bf-card') && !e.target.closest('.bf-card-popup')) {
        this._closePopup();
      }
    });
  },

  /** 构建所有英雄卡片（仅创建一次 DOM） */
  _buildCards() {
    const html = HEROES.map(h => {
      const roleCls = ROLE_CLASS[h.role] || 'role-default';
      return `<div class="bf-card ${roleCls}" data-hero="${h.id}" style="--card-color:${h.color}">
        <div class="bf-card-top">
          <span class="bf-card-stars">★</span>
          <span class="bf-card-hp">❤${h.hp}</span>
        </div>
        <div class="bf-card-name">${h.name}</div>
        <div class="bf-card-role-tag">${h.role}</div>
        <div class="bf-card-stats">⚔${h.attack} · 🎯${h.range}</div>
        <div class="bf-card-super locked">🔮 ${h.super.name.replace('超级技能：', '')}</div>
        <div class="bf-card-count hidden" data-count></div>
      </div>`;
    }).join('');
    this._els.cards.innerHTML = html;
    this._els.cards.querySelectorAll('.bf-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onCardClick(card);
      });
    });
  },

  _onCardClick(card) {
    const heroId = card.dataset.hero;
    if (this._selectedHero === heroId) {
      this._closePopup();
      return;
    }
    this._selectedHero = heroId;
    this._els.cards.querySelectorAll('.bf-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.hero === heroId);
    });
    this._buildPopup(heroId, card);
  },

  /** 构建弹层 DOM（仅在选中新卡片时调用一次） */
  _buildPopup(heroId, card) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return;
    const curStar = Game.systems.heroes.getStar(heroId);
    const recruitCost = data.cost.tickets || 1;
    const upgCost = curStar >= 5 ? null : STAR_UPGRADE_COST[curStar - 1];
    // 招募按钮
    const recruitBtn = `<button class="bf-popup-btn recruit" data-act="recruit">
      <span class="bf-popup-btn-label">招募</span>
      <span class="bf-popup-btn-cost">🎫${recruitCost}</span>
    </button>`;
    // 升星按钮
    let upgBtn;
    if (upgCost === null) {
      upgBtn = `<button class="bf-popup-btn starup" disabled><span class="bf-popup-btn-label">已满星</span></button>`;
    } else {
      upgBtn = `<button class="bf-popup-btn starup gold" data-act="star-up">
        <span class="bf-popup-btn-label">升星 ${curStar}→${curStar + 1}</span>
        <span class="bf-popup-btn-cost">💰${upgCost}</span>
      </button>`;
    }
    this._els.popupBtns.innerHTML = recruitBtn + upgBtn;
    this._els.popup.classList.remove('hidden');
    // 存储按钮引用
    this._popupBtns.recruit = this._els.popupBtns.querySelector('[data-act="recruit"]');
    this._popupBtns.starUp = this._els.popupBtns.querySelector('[data-act="star-up"]');
    // 绑定点击事件（一次绑定，不重建）
    if (this._popupBtns.recruit) {
      this._popupBtns.recruit.addEventListener('click', (e) => this._onAction(e, 'recruit'));
    }
    if (this._popupBtns.starUp) {
      this._popupBtns.starUp.addEventListener('click', (e) => this._onAction(e, 'star-up'));
    }
    // 定位
    this._positionPopup(card);
    // 立即更新一次按钮状态
    this._updatePopupState();
  },

  /** 定位弹层到卡片正上方 */
  _positionPopup(card) {
    const popup = this._els.popup;
    const rect = card.getBoundingClientRect();
    // 先显示再测量
    popup.style.left = '0px';
    popup.style.top = '0px';
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.top - ph - 8;
    // 边界保护
    if (left < 4) left = 4;
    if (left + pw > window.innerWidth - 4) left = window.innerWidth - pw - 4;
    if (top < 4) top = rect.bottom + 8;  // 上方不够则放下方
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  },

  /** 按钮点击处理 */
  _onAction(e, act) {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (btn.disabled || this._cooldown > 0) return;
    const heroId = this._selectedHero;
    let msg = '';
    let ok = false;
    if (act === 'recruit') {
      ok = Game.systems.heroes.recruit(heroId);
      if (!ok) msg = '英雄券不足';
    } else if (act === 'star-up') {
      ok = Game.systems.heroes.upgradeStar(heroId);
      if (!ok) msg = '金币不足或已满星';
    }
    if (msg) {
      this._toast(msg);
    } else if (ok) {
      // 成功：短暂冷却 + 视觉反馈
      this._startCooldown(btn, 0.35);
      // 如果升星改变了按钮文案，重建弹层
      if (act === 'star-up') {
        const card = this._els.cards.querySelector(`[data-hero="${heroId}"]`);
        if (card) this._buildPopup(heroId, card);
      }
    }
  },

  /** 启动冷却：按钮短暂禁用 + 缩放动画 */
  _startCooldown(btn, duration) {
    this._cooldown = duration;
    this._cooldownBtn = btn;
    btn.classList.add('cooldown');
    btn.disabled = true;
  },

  /** 每帧更新弹层按钮的 disabled 状态（不重建 DOM） */
  _updatePopupState() {
    if (!this._selectedHero) return;
    const st = Game.state;
    const data = HEROES.find(h => h.id === this._selectedHero);
    if (!data) return;
    // 冷却倒计时
    if (this._cooldown > 0) {
      this._cooldown -= 1 / 60;  // 近似 dt
      if (this._cooldown <= 0 && this._cooldownBtn) {
        this._cooldownBtn.classList.remove('cooldown');
        this._cooldownBtn = null;
      }
    }
    // 招募按钮
    if (this._popupBtns.recruit && !this._popupBtns.recruit.classList.contains('cooldown')) {
      const canRecruit = st.tickets >= (data.cost.tickets || 1) && this._cooldown <= 0;
      this._popupBtns.recruit.disabled = !canRecruit;
    }
    // 升星按钮
    if (this._popupBtns.starUp && this._popupBtns.starUp.hasAttribute('data-act') &&
        !this._popupBtns.starUp.classList.contains('cooldown')) {
      const curStar = Game.systems.heroes.getStar(this._selectedHero);
      if (curStar < 5) {
        const upgCost = STAR_UPGRADE_COST[curStar - 1];
        const canUpg = st.gold >= upgCost && this._cooldown <= 0;
        this._popupBtns.starUp.disabled = !canUpg;
      }
    }
  },

  _closePopup() {
    this._selectedHero = null;
    this._cooldown = 0;
    this._cooldownBtn = null;
    this._els.popup.classList.add('hidden');
    this._els.cards.querySelectorAll('.bf-card').forEach(c => c.classList.remove('selected'));
  },

  /** 每帧刷新卡片数值 + 弹层按钮状态 */
  refresh() {
    const st = Game.state;
    if (!st) return;
    this._els.cards.querySelectorAll('.bf-card').forEach(card => {
      const heroId = card.dataset.hero;
      const data = HEROES.find(h => h.id === heroId);
      if (!data) return;
      const star = Game.systems.heroes.getStar(heroId);
      const hp = Math.floor(data.hp * Math.pow(STAR_GROWTH.hp, star - 1));
      const atk = Math.floor(data.attack * Math.pow(STAR_GROWTH.attack, star - 1));
      const count = Game.entities.heroes.filter(h => h.id === heroId).length;
      card.querySelector('.bf-card-stars').textContent = '★'.repeat(star);
      card.querySelector('.bf-card-hp').textContent = `❤${hp}`;
      card.querySelector('.bf-card-stats').textContent = `⚔${atk} · 🎯${data.range}`;
      const superEl = card.querySelector('.bf-card-super');
      const unlocked = star >= SUPER_UNLOCK_STAR;
      superEl.className = `bf-card-super ${unlocked ? 'unlocked' : 'locked'}`;
      const countEl = card.querySelector('[data-count]');
      if (count > 0) {
        countEl.textContent = `×${count}`;
        countEl.classList.remove('hidden');
      } else {
        countEl.classList.add('hidden');
      }
    });
    // 仅更新弹层按钮状态，不重建 DOM
    if (this._selectedHero) {
      this._updatePopupState();
      // 重新定位（防止滚动后位置偏移）
      const card = this._els.cards.querySelector(`[data-hero="${this._selectedHero}"]`);
      if (card) this._positionPopup(card);
    }
  },

  /** 宝库升级弹窗 */
  _showVaultModal() {
    const info = Game.systems.buildings.getVaultInfo();
    const upgBtn = info.upgradeCost !== null
      ? `<button class="bf-popup-btn recruit" id="bf-vault-upg" ${Game.state.gold < info.upgradeCost ? 'disabled' : ''}>
          <span class="bf-popup-btn-label">升级 ${info.level}→${info.level + 1}</span>
          <span class="bf-popup-btn-cost">💰${info.upgradeCost}</span></button>`
      : '<div style="color:var(--color-gold-accent);font-weight:bold;padding:8px;">已满级</div>';
    const html = `<div class="bf-vault-modal" id="bf-vault-modal">
      <div class="bf-vault-content">
        <div class="bf-vault-title">🏦 主题季宝库</div>
        <div class="bf-vault-info">等级 ${info.level}/${info.maxLevel}<br>产金 ${info.goldPerSec}/秒</div>
        ${upgBtn}
        <button class="bf-btn-secondary" id="bf-vault-close" style="margin-top:10px;">关闭</button>
      </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('bf-vault-modal');
    const close = () => modal.remove();
    document.getElementById('bf-vault-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    const upg = document.getElementById('bf-vault-upg');
    if (upg) {
      upg.addEventListener('click', () => {
        const r = Game.systems.buildings.upgradeVault();
        if (!r.ok) this._toast(r.msg);
        close();
      });
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
