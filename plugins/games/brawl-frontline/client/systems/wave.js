/**
 * 波次系统：按 WAVES 数据生成敌人，管理波次推进
 * - startWave(n): 构建 spawn 队列
 * - update(dt): 按 interval 出怪
 * - isCleared(): 队列空且场上无敌人
 * - next(): 进入下一波（Phase 1 共 6 波，6 之后无限追加难度）
 */
import { Game, LAYOUT } from '../core/game.js';
import { WAVES } from '../data/enemies.js';
import { Enemies } from './enemies.js';

export const Wave = {
  current: 0,
  queue: [],        // [{ id, delay }]
  timer: 0,
  spawning: false,

  /** 开始第 n 波 */
  startWave(n) {
    this.current = n;
    this.queue = [];
    this.timer = 0;
    this.spawning = true;
    Game.state.wave = n;

    const def = WAVES.find(w => w.wave === n);
    if (def) {
      // 按 enemy 分组展开为单只出怪队列
      def.enemies.forEach(group => {
        for (let i = 0; i < group.count; i++) {
          this.queue.push({ id: group.id, delay: i * group.interval });
        }
      });
    } else {
      // 超出预设波次：无限模式，按难度递增
      this._generateEndless(n);
    }
    Game.state.phase = 'wave';
  },

  /** 无限波次生成（第 7 波起）- 数量指数级增长，混合所有敌人类型
   *  设计：直冲基地（grunt+heavy+shield）与攻击英雄（gunner+bomber）数量接近 */
  _generateEndless(n) {
    const extra = n - 6;
    // 数量指数级增长，设上限避免画面卡顿（40+20+30+15+6 = 111 只封顶）
    const gruntCount = Math.min(40, 4 + Math.floor(Math.pow(1.25, extra)));
    const heavyCount = Math.min(20, 1 + Math.floor(Math.pow(1.20, extra)));
    const gunnerCount = Math.min(30, 3 + Math.floor(Math.pow(1.24, extra)));
    const bomberCount = Math.min(15, 1 + Math.floor(extra * 0.7));
    const shieldCount = Math.min(6, Math.floor(extra / 2));
    // 出怪间隔随波数缩短（数量多时密集出怪，避免一波耗时过长）
    const gruntInterval = Math.max(0.18, 0.55 - extra * 0.02);
    const heavyInterval = Math.max(0.3, 0.85 - extra * 0.03);
    const gunnerInterval = Math.max(0.2, 0.55 - extra * 0.02);
    const gruntEnd = (gruntCount - 1) * gruntInterval;
    const heavyEnd = gruntEnd + 2 + (heavyCount - 1) * heavyInterval;
    // 普通机器人（紧凑出怪）
    for (let i = 0; i < gruntCount; i++) {
      this.queue.push({ id: 'grunt-bot', delay: i * gruntInterval });
    }
    // 胖机器人（grunt 之后 2s 开始）
    for (let i = 0; i < heavyCount; i++) {
      this.queue.push({ id: 'heavy-bot', delay: gruntEnd + 2 + i * heavyInterval });
    }
    // 快射手（与胖机器人同期穿插）
    for (let i = 0; i < gunnerCount; i++) {
      this.queue.push({ id: 'gunner-bot', delay: gruntEnd + 1 + i * gunnerInterval });
    }
    // 爆破兵（heavy 之后）
    for (let i = 0; i < bomberCount; i++) {
      this.queue.push({ id: 'bomber-bot', delay: heavyEnd + 1 + i * 1.5 });
    }
    // 盾卫（每 2 波追加 1 只）
    for (let i = 0; i < shieldCount; i++) {
      this.queue.push({ id: 'shield-guard', delay: heavyEnd + 0.5 + i * 2 });
    }
    // Boss（每 5 波一次，轮换 4 种 Boss）
    if (n % 5 === 0) {
      const bosses = ['shield-boss', 'berserker-boss', 'elite-summoner', 'mega-pig'];
      const idx = (Math.floor(n / 5) - 2) % bosses.length;
      this.queue.push({ id: bosses[idx], delay: heavyEnd + 3 });
    }
  },

  update(dt) {
    if (!this.spawning) return;
    this.timer += dt;
    while (this.queue.length > 0 && this.queue[0].delay <= this.timer) {
      const item = this.queue.shift();
      Enemies.spawn(item.id);
    }
    if (this.queue.length === 0) {
      this.spawning = false;
    }
  },

  /** 本波出怪完毕且场上无敌人 → 清空 */
  isCleared() {
    return !this.spawning && this.queue.length === 0;
  },

  /** 进入下一波 */
  next() {
    const nextN = this.current + 1;
    // 波间短暂奖励：少量金币
    Game.state.gold += 30;
    this.startWave(nextN);
    document.dispatchEvent(new CustomEvent('bf-wave-next'));
  },

  /** 当前波是否为 Boss 波 */
  isBossWave() {
    const def = WAVES.find(w => w.wave === this.current);
    return !!(def && def.isBoss);
  }
};
