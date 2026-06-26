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
import { AntiCheat } from './core/anti-cheat.js';

function boot() {
  // 1. 初始化游戏状态
  Game.init();
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
  // 功成身退按钮
  document.getElementById('bf-retire-btn').addEventListener('click', () => Modals.showRetireConfirm());
  // 英雄解锁按钮
  document.getElementById('bf-unlock-btn').addEventListener('click', () => Unlock.show());

  // 6. 反作弊输入追踪：监听全局点击/触屏/按键（捕获玩家真实操作）
  document.addEventListener('mousedown', () => AntiCheat.tap());
  document.addEventListener('touchstart', () => AntiCheat.tap(), { passive: true });
  document.addEventListener('keydown', (e) => { if (!e.repeat) AntiCheat.tap(); });

  // 7. Hook 渲染循环：每帧渲染后同步更新 HUD、面板按钮状态与功成身退按钮可见性
  const origRender = Game.render.bind(Game);
  Game.render = function () {
    origRender();
    Hud.update();
    Shop.refresh();
    _updateRetireBtn();
  };

  // 8. 启动主循环并进入英雄选择
  Game.start();
  Modals.showHeroSelect();

  // 9. 首次进入炮台位置提示（localStorage 记录关闭状态，仅显示一次）
  _initFacilityTip();
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

/** 功成身退按钮仅在 wave 阶段可见（英雄选择/强化/结束均隐藏） */
function _updateRetireBtn() {
  const btn = document.getElementById('bf-retire-btn');
  if (!btn) return;
  const inWave = Game.state.phase === 'wave';
  btn.classList.toggle('hidden', !inWave);
}

boot();
