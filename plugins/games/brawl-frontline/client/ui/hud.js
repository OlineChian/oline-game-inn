/**
 * 顶部 HUD：5 个双行 tab 实时更新
 * 金币 / 英雄券 / 当前波 / 强化选择 / 宝库
 * 强化与宝库使用 --progress CSS 变量驱动整体进度条背景
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
      buffBtn: document.getElementById('bf-buff-btn'),
      buffText: document.getElementById('bf-buff-text'),
      vaultLv: document.getElementById('bf-vault-lv'),
      vaultBtn: document.getElementById('bf-vault-btn'),
      pauseBtn: document.getElementById('bf-pause-btn')
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
    // 强化选择：文本 [已杀敌]-[下次目标]，整体进度条由 --progress 驱动
    const target = st.buffTarget || BUFF_TARGETS[0];
    const prevTarget = st.buffTargetIdx > 0 ? BUFF_TARGETS[st.buffTargetIdx - 1] : 0;
    const cur = st.killCounter - prevTarget;
    const span = target - prevTarget;
    const buffRatio = Math.max(0, Math.min(1, cur / span));
    if (e.buffText) e.buffText.textContent = `${st.killCounter}-${target}`;
    if (e.buffBtn) {
      e.buffBtn.style.setProperty('--progress', `${buffRatio * 100}%`);
      e.buffBtn.classList.toggle('ready', buffRatio >= 1);
    }
    // 宝库：等级 + 整体进度条（--progress 驱动）
    if (e.vaultLv) e.vaultLv.textContent = Game.buildings.vault.level;
    if (e.vaultBtn) {
      const vi = Game.systems.buildings.getVaultInfo();
      e.vaultBtn.classList.remove('ready', 'locked', 'maxed');
      if (vi.isMax) {
        e.vaultBtn.classList.add('maxed');
        e.vaultBtn.style.setProperty('--progress', '0%');
      } else if (!vi.waveReady) {
        e.vaultBtn.classList.add('locked');
        e.vaultBtn.style.setProperty('--progress', '0%');
      } else {
        const r = Math.min(1, st.gold / vi.upgradeCost);
        e.vaultBtn.style.setProperty('--progress', `${r * 100}%`);
        if (r >= 1) e.vaultBtn.classList.add('ready');
      }
    }
    // 暂停按钮：仅 wave 阶段显示；paused 时显示▶（点击继续），否则显示⏸（点击暂停）
    // 弹窗打开时（设置/宝库/解锁等设 paused=true）自动联动为▶图标
    if (e.pauseBtn) {
      const inWave = st.phase === 'wave';
      e.pauseBtn.classList.toggle('hidden', !inWave);
      const showPlay = st.paused;
      const playIcon = e.pauseBtn.querySelector('.bf-icon-play');
      const pauseIcon = e.pauseBtn.querySelector('.bf-icon-pause');
      if (playIcon) playIcon.classList.toggle('hidden', !showPlay);
      if (pauseIcon) pauseIcon.classList.toggle('hidden', showPlay);
    }
  }
};
