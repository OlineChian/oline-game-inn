/**
 * 底部英雄卡片系统（手机端友好，横向滑动）
 * - 每个英雄种类一张卡片：英雄色顶条 + 大名字 + 左上星级 + 右上血量 + 属性 + 超能状态
 * - 超能图标：3 星及以上亮显（金色），1/2 星灰显
 * - 点击卡片选中，弹出招募/升星按钮（含金币&英雄券消耗，不足时变灰）
 * - 全局升星：升星后所有同种类英雄与新招募英雄都带新星级
 * - 宝库升级：点击 HUD 宝库按钮弹出升级面板
 */
import { Game } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR } from '../data/heroes.js';

export const Shop = {
  _els: {},
  _selectedHero: null,   // 当前选中的英雄 id

  init() {
    this._els = {
      cards: document.getElementById('bf-cards'),
      popup: document.getElementById('bf-card-popup'),
      popupBtns: document.getElementById('bf-card-popup-btns'),
      vaultBtn: document.getElementById('bf-vault-btn')
    };
    this._buildCards();
    // 宝库按钮
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

  /** 构建所有英雄卡片（仅创建一次 DOM，后续 refresh 仅更新数值） */
  _buildCards() {
    const html = HEROES.map(h => {
      const star = 1;
      const hp = h.hp;
      const atk = h.attack;
      const superUnlocked = star >= SUPER_UNLOCK_STAR;
      return `<div class="bf-card" data-hero="${h.id}" style="--card-color:${h.color}">
        <div class="bf-card-top">
          <span class="bf-card-stars">${'★'.repeat(star)}</span>
          <span class="bf-card-hp">❤${hp}</span>
        </div>
        <div class="bf-card-name">${h.name}</div>
        <div class="bf-card-stats">⚔${atk} · 🎯${h.range}</div>
        <div class="bf-card-super ${superUnlocked ? 'unlocked' : 'locked'}">🔮 ${h.super.name.replace('超级技能：', '')}</div>
        <div class="bf-card-count hidden" data-count></div>
      </div>`;
    }).join('');
    this._els.cards.innerHTML = html;
    // 绑定点击
    this._els.cards.querySelectorAll('.bf-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onCardClick(card);
      });
    });
  },

  /** 点击卡片：选中并弹出操作按钮 */
  _onCardClick(card) {
    const heroId = card.dataset.hero;
    if (this._selectedHero === heroId) {
      this._closePopup();
      return;
    }
    this._selectedHero = heroId;
    // 高亮选中
    this._els.cards.querySelectorAll('.bf-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.hero === heroId);
    });
    this._showPopup(heroId, card);
  },

  /** 显示卡片上方的招募/升星弹层 */
  _showPopup(heroId, card) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return;
    const st = Game.state;
    const curStar = Game.systems.heroes.getStar(heroId);
    const canRecruit = st.tickets >= (data.cost.tickets || 1);
    const recruitCost = data.cost.tickets || 1;
    // 升星
    let upgHtml = '';
    if (curStar >= 5) {
      upgHtml = '<button class="bf-popup-btn gold" disabled><span>已满星</span></button>';
    } else {
      const upgCost = STAR_UPGRADE_COST[curStar - 1];
      const canUpg = st.gold >= upgCost;
      upgHtml = `<button class="bf-popup-btn gold" data-act="star-up" data-hero="${heroId}" ${canUpg ? '' : 'disabled'}>
        <span>升星 ${curStar}→${curStar + 1}</span><span class="bf-popup-btn-cost">💰${upgCost}</span>
      </button>`;
    }
    this._els.popupBtns.innerHTML = `
      <button class="bf-popup-btn" data-act="recruit" data-hero="${heroId}" ${canRecruit ? '' : 'disabled'}>
        <span>招募</span><span class="bf-popup-btn-cost">🎫${recruitCost}</span>
      </button>${upgHtml}`;
    this._els.popup.classList.remove('hidden');
    // 定位弹层到卡片正上方
    const rect = card.getBoundingClientRect();
    const popup = this._els.popup;
    popup.style.left = `${rect.left + rect.width / 2 - popup.offsetWidth / 2}px`;
    popup.style.top = `${rect.top - popup.offsetHeight - 8}px`;
    // 边界保护
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.left < 4) popup.style.left = '4px';
    if (popupRect.right > window.innerWidth - 4) {
      popup.style.left = `${window.innerWidth - popup.offsetWidth - 4}px`;
    }
    // 绑定按钮
    this._els.popupBtns.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const act = btn.dataset.act;
        let msg = '';
        if (act === 'recruit') {
          const r = Game.systems.heroes.recruit(btn.dataset.hero);
          if (!r) msg = '英雄券不足';
        } else if (act === 'star-up') {
          const r = Game.systems.heroes.upgradeStar(btn.dataset.hero);
          if (!r) msg = '金币不足或已满星';
        }
        if (msg) this._toast(msg);
        this._refreshPopup(btn.dataset.hero);
      });
    });
  },

  /** 刷新弹层按钮状态（招募/升星后） */
  _refreshPopup(heroId) {
    const card = this._els.cards.querySelector(`[data-hero="${heroId}"]`);
    if (card) this._showPopup(heroId, card);
  },

  _closePopup() {
    this._selectedHero = null;
    this._els.popup.classList.add('hidden');
    this._els.cards.querySelectorAll('.bf-card').forEach(c => c.classList.remove('selected'));
  },

  /** 每帧刷新卡片数值（不重建 DOM，仅更新文本/样式） */
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
      // 更新星级
      card.querySelector('.bf-card-stars').textContent = '★'.repeat(star);
      // 更新血量
      card.querySelector('.bf-card-hp').textContent = `❤${hp}`;
      // 更新属性
      card.querySelector('.bf-card-stats').textContent = `⚔${atk} · 🎯${data.range}`;
      // 更新超能状态
      const superEl = card.querySelector('.bf-card-super');
      const unlocked = star >= SUPER_UNLOCK_STAR;
      superEl.className = `bf-card-super ${unlocked ? 'unlocked' : 'locked'}`;
      // 更新数量徽章
      const countEl = card.querySelector('[data-count]');
      if (count > 0) {
        countEl.textContent = `×${count}`;
        countEl.classList.remove('hidden');
      } else {
        countEl.classList.add('hidden');
      }
    });
    // 如果弹层打开，刷新按钮可用态
    if (this._selectedHero) this._refreshPopup(this._selectedHero);
  },

  /** 宝库升级弹窗 */
  _showVaultModal() {
    const info = Game.systems.buildings.getVaultInfo();
    const upgBtn = info.upgradeCost !== null
      ? `<button class="bf-popup-btn" id="bf-vault-upg" ${Game.state.gold < info.upgradeCost ? 'disabled' : ''}>
          <span>升级 ${info.level}→${info.level + 1}</span><span class="bf-popup-btn-cost">💰${info.upgradeCost}</span></button>`
      : '<div style="color:var(--color-gold-accent);font-weight:bold;">已满级</div>';
    let html = `<div class="bf-vault-modal" id="bf-vault-modal">
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
