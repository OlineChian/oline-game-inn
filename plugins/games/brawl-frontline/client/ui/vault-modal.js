/** 宝库升级弹窗（从 shop.js 抽离，保持 shop.js ≤300 行） */
import { Game } from '../core/game.js';
import { BUILDINGS } from '../data/buildings.js';
import { MergingUI } from './merging.js';

/** 计算宝库某等级解锁所需波数（level 由 upgradeWaves[level-2] 决定，level=1 起始无需解锁） */
function waveForLevel(level) {
  if (level <= 1) return 0;
  return BUILDINGS['vault'].upgradeWaves[level - 2] || 0;
}

export const VaultModal = {
  show() {
    Game.state.paused = true;
    const info = Game.systems.buildings.getVaultInfo();
    let upgBtn;
    if (info.isMax) {
      upgBtn = '<div class="bf-vault-maxed">已达最高等级</div>';
    } else if (!info.waveReady) {
      upgBtn = `<button class="bf-popup-btn starup locked" disabled style="--progress:0%"><span class="bf-popup-btn-label">产金速度升级</span><span class="bf-popup-btn-sub">第${info.requiredWave}波解锁</span></button>`;
    } else {
      const ratio = Math.min(1, Game.state.gold / info.upgradeCost);
      upgBtn = `<button class="bf-popup-btn starup" id="bf-vault-upg" style="--progress:${ratio * 100}%" ${ratio < 1 ? 'disabled' : ''}><span class="bf-popup-btn-label">产金速度升级 ${info.level}→${info.level + 1}</span><span class="bf-popup-btn-cost">💰${info.upgradeCost}</span></button>`;
    }
    const status = info.isMax ? '已达最高等级' : (info.waveReady ? `需要 💰${info.upgradeCost}` : `第${info.requiredWave}波升级产金速度`);
    // 6 星合并：宝库 6 级解锁（第30波升到 6 级）
    const m6Unlocked = info.level >= 6;
    const m6Btn = m6Unlocked
      ? `<button class="bf-popup-btn starup bf-vault-merge-btn" data-merge="star5to6"><span class="bf-popup-btn-label">6星合并</span><span class="bf-popup-btn-sub">2 个 5★ → 1 个 6★</span></button>`
      : `<div class="bf-vault-locked-tip">6星合并：宝库 6 级解锁（第${waveForLevel(6)}波）</div>`;
    // 7 星合并：宝库 10 级解锁（第90波升到 10 级）
    const m7Unlocked = info.level >= 10;
    const m7Btn = m7Unlocked
      ? `<button class="bf-popup-btn starup bf-vault-merge-btn" data-merge="star6to7"><span class="bf-popup-btn-label">7星合并</span><span class="bf-popup-btn-sub">2 个 6★ → 1 个 7★</span></button>`
      : `<div class="bf-vault-locked-tip">7星合并：宝库 10 级解锁（第${waveForLevel(10)}波）</div>`;
    const html = `<div class="bf-vault-modal" id="bf-vault-modal"><div class="bf-vault-content">
        <div class="bf-vault-title">宝库 ${info.level}/${info.maxLevel}</div>
        <div class="bf-vault-info">产金 ${info.goldPerSec}/秒<br>${status}</div>
        ${upgBtn}${m6Btn}${m7Btn}
        <button class="bf-btn-secondary" id="bf-vault-close" style="margin-top:10px;">关闭</button>
      </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('bf-vault-modal');
    const close = () => { modal.remove(); Game.state.paused = false; };
    document.getElementById('bf-vault-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    const upg = document.getElementById('bf-vault-upg');
    if (upg) upg.addEventListener('click', () => {
      const r = Game.systems.buildings.upgradeVault();
      if (!r.ok) this._toast(r.msg);
      close();
    });
    // 6 星 / 7 星合并按钮：关闭本弹窗后进入对应合并界面
    modal.querySelectorAll('[data-merge]').forEach(b => {
      b.addEventListener('click', () => {
        const type = b.dataset.merge;
        close();
        MergingUI.show(type);
      });
    });
  },

  _toast(msg) {
    const el = document.getElementById('bf-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('show'), 1500);
  }
};
