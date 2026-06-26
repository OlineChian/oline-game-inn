/**
 * BRAWL FRONTLINE 入口
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
import { Hud } from './ui/hud.js';
import { Shop } from './ui/shop.js';
import { Modals } from './ui/modals.js';
import { Leaderboard } from './ui/leaderboard.js';

function boot() {
  // 1. 初始化游戏状态
  Game.init();

  // 2. 注入系统（Game.systems 供调度与 UI 调用）
  Game.use({
    economy: Economy,
    buildings: Buildings,
    heroes: Heroes,
    enemies: Enemies,
    combat: Combat,
    wave: Wave,
    buffs: Buffs,
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

  // 5. 绑定顶部栏按钮（避免全局函数污染）
  document.getElementById('bf-lb-btn').addEventListener('click', () => Leaderboard.show());
  document.getElementById('bf-lb-close').addEventListener('click', () => Leaderboard.close());
  document.getElementById('bf-lb-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) Leaderboard.close();
  });

  // 6. Hook 渲染循环：每帧渲染后同步更新 HUD 与面板按钮状态
  const origRender = Game.render.bind(Game);
  Game.render = function () {
    origRender();
    Hud.update();
    Shop.refresh();
  };

  // 7. 启动主循环并进入英雄选择
  Game.start();
  Modals.showHeroSelect();
}

boot();
