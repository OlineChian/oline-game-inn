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
    Game.state.paused = false;  // 确保恢复（防止异常残留 paused=true）
    Wave.startWave(1);
  },

  /** 强化三选一（Game.systems.ui.showBuffSelect 回调）
   *  两步操作：先点选高亮 → 再点确认按钮 */
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
    html += '<div class="bf-buff-confirm-bar"><button class="bf-buff-confirm-btn" id="bf-buff-confirm" disabled>确认选择</button></div>';
    body.innerHTML = html;
    document.getElementById('bf-modal').classList.remove('hidden');
    let selectedBuff = null;
    const confirmBtn = document.getElementById('bf-buff-confirm');
    body.querySelectorAll('.bf-buff-card').forEach(card => {
      card.addEventListener('click', () => {
        body.querySelectorAll('.bf-buff-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedBuff = card.dataset.buff;
        confirmBtn.disabled = false;
      });
    });
    confirmBtn.addEventListener('click', () => {
      if (!selectedBuff) return;
      Buffs.choose(selectedBuff);
      document.getElementById('bf-modal').classList.add('hidden');
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
    Game.state.paused = true;
    const st = Game.state;
    const score = Game.calcScore();
    const bd = Game.scoreBreakdown();
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">功成身退</div>';
    html += `<div class="bf-retire-score">当前得分</div>`;
    html += `<div class="bf-gameover-score">${fmtNum(score)}<span>分</span></div>`;
    html += '<div class="bf-gameover-detail">';
    html += `<div>波数 ×100</div><div>${bd.waveScore}</div>`;
    html += `<div>击杀 ×2</div><div>${bd.killScore}</div>`;
    html += `<div>Boss ×300</div><div>${bd.bossScore}</div>`;
    html += `<div>累计金币 ×0.2</div><div>${bd.goldScore}</div>`;
    html += `<div>累计英雄券 ×0.5</div><div>${bd.ticketScore}</div>`;
    html += `<div>英雄星级 ×200</div><div>${bd.starScore}</div>`;
    html += `<div>招募英雄</div><div>${bd.recruitScore}</div>`;
    html += `<div>合并英雄</div><div>${bd.mergeScore}</div>`;
    html += `<div>总分</div><div>${bd.total}</div>`;
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
      Game.state.paused = false;
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
    const bd = Game.scoreBreakdown();
    const rank = result && result.success ? `排名 #${result.rank}` : '';
    const body = document.getElementById('bf-modal-body');
    let html = '<div class="bf-modal-title">游戏结束</div>';
    html += `<div class="bf-gameover-score">${fmtNum(score)}<span>分</span></div>`;
    html += `<div class="bf-gameover-rank">${rank}</div>`;
    html += '<div class="bf-gameover-detail">';
    html += `<div>波数 ×100</div><div>${bd.waveScore}</div>`;
    html += `<div>击杀 ×2</div><div>${bd.killScore}</div>`;
    html += `<div>Boss ×300</div><div>${bd.bossScore}</div>`;
    html += `<div>累计金币 ×0.2</div><div>${bd.goldScore}</div>`;
    html += `<div>累计英雄券 ×0.5</div><div>${bd.ticketScore}</div>`;
    html += `<div>英雄星级 ×200</div><div>${bd.starScore}</div>`;
    html += `<div>招募英雄</div><div>${bd.recruitScore}</div>`;
    html += `<div>合并英雄</div><div>${bd.mergeScore}</div>`;
    html += `<div>总分</div><div>${bd.total}</div>`;
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
