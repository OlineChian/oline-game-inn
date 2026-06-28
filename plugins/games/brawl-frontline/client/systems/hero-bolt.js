/**
 * 博尔特专属 AI：椭圆巡逻 + 碰撞伤害 + 燃烧路径超能
 * - 沿随机椭圆路径绕场移动，椭圆中心偏向敌人密集区（每 6 秒重生成）
 * - 敌人碰到博尔特受大量伤害（每 0.5 秒按 attack 计算）
 * - 超能（fire-trail）在当前位置生成燃烧区域，伤害 = attack，持续 8 秒
 *
 * 依赖方向：heroes.js → BoltAI（单向），BoltAI 不引用 Heroes
 */
import { Game, LAYOUT } from '../core/game.js';
import { distance, clamp } from '../core/utils.js';
import { Enemies } from './enemies.js';

const VIEW_W = 480;

export const BoltAI = {
  /** 更新博尔特：椭圆巡逻 + 碰撞伤害（超能释放由 heroes.js 统一调度） */
  update(h, dt) {
    if (!h._ellipse) h._ellipse = this._genEllipse();
    const e = h._ellipse;
    e.t += dt * (h.moveSpeed / 200);      // 角速度与移速挂钩
    e.timer = (e.timer || 0) + dt;
    if (e.timer > 6) h._ellipse = this._genEllipse();   // 每 6 秒重生成，偏向敌人密集区
    // 沿椭圆移动
    h.x = clamp(e.cx + e.rx * Math.cos(e.t), 30, VIEW_W - 30);
    h.y = clamp(e.cy + e.ry * Math.sin(e.t), LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    // 碰撞伤害：每 0.5 秒对接触敌人造成 attack 伤害
    h.atkCd = Math.max(0, h.atkCd - dt);
    if (h.atkCd <= 0) {
      let hit = false;
      for (const en of Game.entities.enemies) {
        if (distance(h, en) <= h.radius + en.radius) {
          Enemies.takeDamage(en, h.attack);
          hit = true;
        }
      }
      if (hit) {
        h.atkCd = 0.5;
        h.superCharge = Math.min(1, h.superCharge + h.superDef.chargePerHit);
      }
    }
  },

  /** 生成随机椭圆参数，中心偏向敌人平均位置（尽可能碰到敌人） */
  _genEllipse() {
    let cx = VIEW_W / 2, cy = 320;
    const enemies = Game.entities.enemies;
    if (enemies.length > 0) {
      let sx = 0, sy = 0;
      enemies.forEach(en => { sx += en.x; sy += en.y; });
      cx = sx / enemies.length;
      cy = sy / enemies.length;
    }
    return {
      cx, cy,
      rx: 140 + Math.random() * 80,    // 140~220
      ry: 100 + Math.random() * 60,    // 100~160
      t: Math.random() * Math.PI * 2,
      timer: 0
    };
  },

  /** 超能释放：在当前位置生成燃烧区域 */
  spawnFireZone(h) {
    Game.entities.fireZones.push({
      x: h.x, y: h.y,
      radius: 50,
      damage: h.attack,         // 伤害 = 博尔特 attack
      duration: 8,              // 持续 8 秒
      tickCd: 0,                // 每秒伤害计数
      color: h.accent
    });
  },

  /** 更新所有燃烧区域：每秒对范围内敌人造成伤害，到期消失 */
  updateFireZones(dt) {
    const zs = Game.entities.fireZones;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      z.duration -= dt;
      z.tickCd -= dt;
      if (z.duration <= 0) { zs.splice(i, 1); continue; }
      if (z.tickCd <= 0) {
        for (const en of Game.entities.enemies) {
          if (distance(z, en) <= z.radius + en.radius) {
            Enemies.takeDamage(en, z.damage);
          }
        }
        z.tickCd = 1;
      }
    }
  }
};
