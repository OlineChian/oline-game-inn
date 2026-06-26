/**
 * 弹窗系统：起始英雄3选1、强化三选一、游戏结束
 * 实现 Game.systems.ui 回调接口（showHeroSelect / showBuffSelect / onGameOver）
 */
import { Game } from '../core/game.js';
import { HEROES } from '../data/heroes.js';
import { pickN, fmtNum } from '../core/utils.js';
import { Buffs } from '../systems/buffs.js';
import { Heroes } from '../systems/heroes.js';
import { Wave } from '../systems/wave.js';
import { Leaderboard } from './leaderboard.js';

export const Modals = {
  /** 显示起始英雄3选1 */
  showHeroSelect() {
    const choices = pickN(HEROES, 3);
    Game.state.heroChoices = choices;
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">选择初始英雄</div>';
    html += '<div class="bf-hero-choices">';
    choices.forEach(h => {
      html += `<div class="bf-hero-card" data-hero="${h.id}">
        <div class="bf-hero-card-icon" style="background:${h.color}">${h.name[0]}</div>
        <div class="bf-hero-card-name">${h.name}</div>
        <div class="bf-hero-card-role">${h.role}</div>
        <div class="bf-hero-card-stat">❤ ${h.hp} · ⚔ ${h.attack} · 🎯 ${h.range}</div>
        <div class="bf-hero-card-super">${h.super.name}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    body.querySelectorAll('.bf-hero-card').forEach(card => {
      card.addEventListener('click', () => this._onHeroChosen(card.dataset.hero));
    });
  },

  _onHeroChosen(heroId) {
    Heroes.recruitStarter(heroId);
    document.getElementById('bf-modal').classList.add('hidden');
    Wave.startWave(1);
  },

  /** 强化三选一（Game.systems.ui.showBuffSelect 回调） */
  showBuffSelect(choices) {
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">选择强化</div>';
    html += '<div class="bf-buff-choices">';
    choices.forEach(b => {
      const color = Buffs.qualityColor(b.quality);
      html += `<div class="bf-buff-card" data-buff="${b.id}" style="border-color:${color}">
        <div class="bf-buff-quality" style="color:${color}">${this._qualityLabel(b.quality)}</div>
        <div class="bf-buff-name">${b.name}</div>
        <div class="bf-buff-desc">${b.desc}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    body.querySelectorAll('.bf-buff-card').forEach(card => {
      card.addEventListener('click', () => {
        Buffs.choose(card.dataset.buff);
        document.getElementById('bf-modal').classList.add('hidden');
      });
    });
  },

  /** 游戏结束（Game.systems.ui.onGameOver 回调） */
  async onGameOver() {
    const st = Game.state;
    const score = st.finalScore;
    // 提交排行榜
    const result = await Leaderboard.submit(score, {
      wave: st.wave, kills: st.kills, bossKills: st.bossKills
    });
    const rank = result && result.success ? `排名 #${result.rank}` : '';
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">游戏结束</div>';
    html += `<div class="bf-gameover-score">${fmtNum(score)}<span>分</span></div>`;
    html += `<div class="bf-gameover-rank">${rank}</div>`;
    html += '<div class="bf-gameover-detail">';
    html += `<div>波数 ×100</div><div>${st.wave} × 100 = ${st.wave * 100}</div>`;
    html += `<div>击杀 ×2</div><div>${st.kills} × 2 = ${st.kills * 2}</div>`;
    html += `<div>Boss ×300</div><div>${st.bossKills} × 300 = ${st.bossKills * 300}</div>`;
    html += `<div>基地血量</div><div>${Math.floor(st.baseHp)}</div>`;
    html += `<div>金币 ÷20</div><div>${Math.floor(st.gold / 20)}</div>`;
    html += '</div>';
    html += '<div class="bf-gameover-btns">';
    html += '<button class="bf-btn-primary" id="bf-restart">再来一局</button>';
    html += '<button class="bf-btn-secondary" id="bf-view-lb">排行榜</button>';
    html += '</div>';
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    document.getElementById('bf-restart').addEventListener('click', () => location.reload());
    document.getElementById('bf-view-lb').addEventListener('click', () => Leaderboard.show());
  },

  /** 超级技能释放提示（浮动文字） */
  showHint(text) {
    const el = document.getElementById('bf-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;  // 强制重绘以重启动画
    el.classList.add('show');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => el.classList.remove('show'), 1400);
  },

  _qualityLabel(q) {
    return { common: '普通', rare: '稀有', epic: '史诗', mythic: '神话', legendary: '传奇' }[q] || q;
  }
};
