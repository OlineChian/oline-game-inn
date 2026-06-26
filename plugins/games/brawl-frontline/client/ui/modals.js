/**
 * 弹窗系统：起始英雄3选1、强化三选一、游戏结束
 * 实现 Game.systems.ui 回调接口（showHeroSelect / showBuffSelect / onGameOver）
 */
import { Game } from '../core/game.js';
import { HEROES, RARITY_LABEL, RARITY_COLOR } from '../data/heroes.js';
import { pickN, fmtNum } from '../core/utils.js';
import { Buffs } from '../systems/buffs.js';
import { Heroes } from '../systems/heroes.js';
import { Wave } from '../systems/wave.js';
import { Leaderboard } from './leaderboard.js';
import { AntiCheat } from '../core/anti-cheat.js';

export const Modals = {
  /** 显示起始英雄3选1（仅从已解锁的初始/稀有英雄中选） */
  showHeroSelect() {
    const pool = HEROES.filter(h => Game.state.unlockedHeroes.includes(h.id));
    const choices = pickN(pool, Math.min(3, pool.length));
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
    // 停止输入监测，锁定遥测数据
    AntiCheat.stop();
    const score = st.finalScore;
    // 提交排行榜（附带 antiCheat 遥测）
    const result = await Leaderboard.submit(score, {
      wave: st.wave, kills: st.kills, bossKills: st.bossKills,
      antiCheat: AntiCheat.getReport()
    });
    this._renderGameOver(score, result);
  },

  /**
   * 功成身退：以当前成绩录入排行榜并退出
   * 仅在 wave 阶段可用，弹出确认框后提交并跳转游戏结束流程
   */
  showRetireConfirm() {
    if (Game.state.phase !== 'wave') return;
    const st = Game.state;
    const score = Game.calcScore();
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">功成身退</div>';
    html += `<div class="bf-retire-score">当前得分</div>`;
    html += `<div class="bf-gameover-score">${fmtNum(score)}<span>分</span></div>`;
    html += '<div class="bf-gameover-detail">';
    html += `<div>当前波数</div><div>第 ${st.wave} 波</div>`;
    html += `<div>累计击杀</div><div>${st.kills}</div>`;
    html += `<div>Boss 击杀</div><div>${st.bossKills}</div>`;
    html += `<div>基地血量</div><div>${Math.floor(st.baseHp)}</div>`;
    html += `<div>英雄数量</div><div>${Game.entities.heroes.length}</div>`;
    html += '</div>';
    html += '<div class="bf-retire-tip">将以当前成绩录入排行榜并结束本局</div>';
    html += '<div class="bf-gameover-btns">';
    html += '<button class="bf-btn-secondary" id="bf-retire-cancel">继续战斗</button>';
    html += '<button class="bf-btn-primary" id="bf-retire-ok">确认退出</button>';
    html += '</div>';
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    document.getElementById('bf-retire-cancel').addEventListener('click', () => {
      document.getElementById('bf-modal').classList.add('hidden');
    });
    document.getElementById('bf-retire-ok').addEventListener('click', async () => {
      // 复用 _gameOver 流程：设置 finalScore → phase 切换 → 提交 → 显示结束页
      Game.state.finalScore = score;
      Game.state.phase = 'game-over';
      AntiCheat.stop();
      const result = await Leaderboard.submit(score, {
        wave: st.wave, kills: st.kills, bossKills: st.bossKills,
        antiCheat: AntiCheat.getReport()
      });
      this._renderGameOver(score, result);
    });
  },

  /** 渲染游戏结束弹窗（onGameOver 与 showRetireConfirm 共用） */
  _renderGameOver(score, result) {
    const st = Game.state;
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

  _qualityLabel(q) {
    return { common: '普通', rare: '稀有', epic: '史诗', mythic: '神话', legendary: '传奇' }[q] || q;
  }
};
