/**
 * 顶部 HUD：金币/英雄券/波数/击杀/强化进度 实时更新
 * 基地血量已移除（在 Canvas 上展示），金币券只在 HUD 显示一次
 */
import { Game } from '../core/game.js';
import { BUFF_TARGETS } from '../data/enemies.js';
import { fmtNum } from '../core/utils.js';

export const Hud = {
  _els: {},

  init() {
    this._els = {
      gold: document.getElementById('bf-gold'),
      tickets: document.getElementById('bf-tickets'),
      wave: document.getElementById('bf-wave'),
      kills: document.getElementById('bf-kills'),
      buffBar: document.getElementById('bf-buff-bar'),
      buffText: document.getElementById('bf-buff-text'),
      vaultLv: document.getElementById('bf-vault-lv')
    };
  },

  /** 每帧更新 HUD 数值 */
  update() {
    const st = Game.state;
    if (!st) return;
    const e = this._els;
    if (e.gold) e.gold.textContent = fmtNum(st.gold);
    if (e.tickets) e.tickets.textContent = st.tickets;
    if (e.wave) e.wave.textContent = st.wave;
    if (e.kills) e.kills.textContent = st.kills;
    // 强化进度条：当前阶段击杀 / 当前阶段目标跨度
    const target = st.buffTarget || BUFF_TARGETS[0];
    const prevTarget = st.buffTargetIdx > 0
      ? BUFF_TARGETS[st.buffTargetIdx - 1]
      : 0;
    const cur = st.killCounter - prevTarget;
    const span = target - prevTarget;
    const ratio = Math.max(0, Math.min(1, cur / span));
    if (e.buffBar) e.buffBar.style.width = `${ratio * 100}%`;
    if (e.buffText) e.buffText.textContent = `${st.killCounter}/${target}`;
    // 宝库等级
    if (e.vaultLv) e.vaultLv.textContent = Game.buildings.vault.level;
  }
};
