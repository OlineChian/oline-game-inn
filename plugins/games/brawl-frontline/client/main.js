/**
 * 乱斗前线入口
 * 组装核心、系统、UI 层，启动游戏主循环
 *
 * 模块依赖关系（避免循环）：
 *   main → Game + Renderer + 各 system + 各 ui
 *   system → Game（共享状态）
 *   ui → Game.systems（调用系统方法）
 */
import { Game } from './core/game.js';
import { Renderer } from './core/renderer.js';
import { Economy } from './systems/economy.js';
import { Buildings } from './systems/buildings.js';
import { Heroes } from './systems/heroes.js';
import { Enemies } from './systems/enemies.js';
import { Combat } from './systems/combat.js';
import { Wave } from './systems/wave.js';
import { Buffs } from './systems/buffs.js';
import { Facilities } from './systems/facilities.js';
import { Hud } from './ui/hud.js';
import { Shop } from './ui/shop.js';
import { Facilities as FacilitiesUI } from './ui/facilities.js';
import { Unlock } from './ui/unlock.js';
import { Modals } from './ui/modals.js';
import { Leaderboard } from './ui/leaderboard.js';
import { Settings } from './ui/settings.js';
import { Audio } from './core/audio.js';
import { AntiCheat } from './core/anti-cheat.js';
import { ModalManager } from './ui/modal-manager.js';
import * as SaveSystem from './systems/save-system.js';

function boot() {
  // 1. 初始化游戏状态
  Game.init();
  // 注册 ModalManager 暂停写入回调（避免循环依赖：ModalManager 不直接 import Game）
  ModalManager.setPauseSetter(p => { Game.state.paused = p; });
  // 启动反作弊遥测（覆盖英雄选择 → wave → 结束整个流程）
  AntiCheat.start();

  // 2. 注入系统（Game.systems 供调度与 UI 调用）
  Game.use({
    economy: Economy,
    buildings: Buildings,
    heroes: Heroes,
    enemies: Enemies,
    combat: Combat,
    wave: Wave,
    buffs: Buffs,
    facilities: Facilities,
    ui: {
      showHeroSelect: () => Modals.showHeroSelect(),
      showBuffSelect: (choices) => Modals.showBuffSelect(choices),
      onGameOver: () => Modals.onGameOver()
    }
  });

  // 3. 绑定渲染器并初始化 Canvas
  Game.bindRenderer(Renderer);
  const canvas = document.getElementById('bf-canvas');
  Renderer.init(canvas);

  // 4. 初始化 UI
  Hud.init();
  Shop.init();
  FacilitiesUI.init();

  // 5. 绑定顶部栏按钮（避免全局函数污染）
  document.getElementById('bf-lb-btn').addEventListener('click', () => Leaderboard.show());
  document.getElementById('bf-lb-close').addEventListener('click', () => Leaderboard.close());
  document.getElementById('bf-lb-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) Leaderboard.close();
  });
  // 设置按钮（含功成身退入口）
  document.getElementById('bf-settings-btn').addEventListener('click', () => Settings.show());
  // 英雄解锁按钮
  document.getElementById('bf-unlock-btn').addEventListener('click', () => Unlock.show());
  // 暂停/继续按钮（Top Layer，由 ModalManager 统一管理暂停态与弹窗关闭）
  document.getElementById('bf-pause-btn').addEventListener('click', () => ModalManager.togglePauseOrDismiss());

  // 6. 反作弊输入追踪：监听全局点击/触屏/按键（捕获玩家真实操作）
  document.addEventListener('mousedown', () => AntiCheat.tap());
  document.addEventListener('touchstart', () => AntiCheat.tap(), { passive: true });
  document.addEventListener('keydown', (e) => { if (!e.repeat) AntiCheat.tap(); });
  // 用户首次交互后尝试播放（浏览器策略；Audio.enabled 默认 false，仅当已开启时才出声）
  const tryPlayBgm = () => Audio.play();
  document.addEventListener('mousedown', tryPlayBgm, { once: true });
  document.addEventListener('touchstart', tryPlayBgm, { once: true, passive: true });

  // 7. Hook 渲染循环：每帧渲染后同步更新 HUD、面板按钮状态与设置按钮可见性
  const origRender = Game.render.bind(Game);
  Game.render = function () {
    origRender();
    try {
      Hud.update();
      Shop.refresh();
      _updateSettingsBtn();
    } catch (e) {
      console.error('[bf] UI refresh error:', e);
    }
  };

  // 8. 启动主循环，初始化存档系统（检测临时存档 / 事件保存 / 周期保存）
  Game.start();
  _initSave();

  // 9. 首次进入炮台位置提示（localStorage 记录关闭状态，仅显示一次）
  _initFacilityTip();
  // 10. 首次进入 BGM 推荐弹窗（有曲目且未关闭过才显示，localStorage 记忆不再推送）
  _initBgmPrompt();
}

/** 初始化存档系统：检测临时存档、注册事件保存与周期保存 */
function _initSave() {
  // 检测未完成的临时存档，弹出继续/重新开始选择
  if (SaveSystem.hasSave()) {
    Modals.showContinuePrompt(
      () => {
        const payload = SaveSystem.loadGame();
        if (payload && SaveSystem.applySnapshot(payload)) {
          Shop._buildCards();
        } else {
          Modals.showHeroSelect();
        }
      },
      () => {
        SaveSystem.clearSave();
        Modals.showHeroSelect();
      }
    );
  } else {
    Modals.showHeroSelect();
  }

  // 事件驱动保存：波次推进 / 暂停态变化
  document.addEventListener('bf-wave-next', () => SaveSystem.save());
  document.addEventListener('bf-pause-change', () => SaveSystem.save());

  // 页面隐藏/关闭时保存（覆盖 F5/关闭/切换标签页/手机后台）
  document.addEventListener('visibilitychange', () => { if (document.hidden) SaveSystem.save(); });
  window.addEventListener('pagehide', () => SaveSystem.save());
  window.addEventListener('beforeunload', () => SaveSystem.save());

  // 周期性保存（每 10 秒兜底）
  setInterval(() => SaveSystem.save(), 10000);
}

/** BGM 首次推荐：加载曲目清单后，若未关闭过且有曲目，显示右上角弹窗 */
function _initBgmPrompt() {
  const KEY = 'bf:bgm-prompt-closed';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) { return; }
  Audio.init().then(() => {
    if (!Audio.hasTracks()) return;  // 无曲目不打扰
    const el = document.getElementById('bf-bgm-prompt');
    if (!el) return;
    el.classList.remove('hidden');
    const close = (enable) => {
      el.classList.add('hidden');
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      if (enable) { Audio.enabled = true; Audio.play(); }
    };
    document.getElementById('bf-bgm-prompt-on').addEventListener('click', () => close(true));
    document.getElementById('bf-bgm-prompt-off').addEventListener('click', () => close(false));
    document.getElementById('bf-bgm-prompt-close').addEventListener('click', () => close(false));
  });
}

/** 炮台位置首次提示：未关闭过则显示，X 按钮关闭并记录 */
function _initFacilityTip() {
  const tip = document.getElementById('bf-tip-facility');
  const closeBtn = document.getElementById('bf-tip-close');
  if (!tip || !closeBtn) return;
  try {
    if (localStorage.getItem('bf:facility-tip-closed') === '1') return;
  } catch (e) { /* localStorage 不可用时也显示 */ }
  tip.classList.remove('hidden');
  closeBtn.addEventListener('click', () => {
    tip.classList.add('hidden');
    try { localStorage.setItem('bf:facility-tip-closed', '1'); } catch (e) {}
  });
}

/** 设置按钮仅在 wave 阶段可见（英雄选择/强化/结束均隐藏） */
function _updateSettingsBtn() {
  const btn = document.getElementById('bf-settings-btn');
  if (!btn) return;
  const inWave = Game.state.phase === 'wave';
  btn.classList.toggle('hidden', !inWave);
}

boot();
