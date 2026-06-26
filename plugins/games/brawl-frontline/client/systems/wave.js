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

  /** 无限波次生成（第 7 波起） */
  _generateEndless(n) {
    const extra = n - 6;
    const gruntCount = 8 + extra * 2;
    const heavyCount = 3 + extra;
    for (let i = 0; i < gruntCount; i++) this.queue.push({ id: 'grunt-bot', delay: i * 0.7 });
    for (let i = 0; i < heavyCount; i++) this.queue.push({ id: 'heavy-bot', delay: 50 + i * 1.5 });
    // 每 5 波加一个 Boss
    if (n % 5 === 0) this.queue.push({ id: 'mega-pig', delay: 80 });
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
  },

  /** 当前波是否为 Boss 波 */
  isBossWave() {
    const def = WAVES.find(w => w.wave === this.current);
    return !!(def && def.isBoss);
  }
};
