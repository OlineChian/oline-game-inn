/**
 * 战斗系统：投射物移动、碰撞、伤害结算
 * - 远程英雄/炮台通过 spawnProjectile 创建投射物
 * - 投射物按速度移动，命中敌人后造成伤害并销毁
 * - 近战即时命中由各系统直接调用 Enemies.takeDamage
 */
import { Game } from '../core/game.js';
import { distance, uid } from '../core/utils.js';
import { Enemies } from './enemies.js';

export const Combat = {
  update(dt) {
    const ps = Game.entities.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      // 移动
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // 命中检测：找最近敌人
      let hit = false;
      if (p.targetTeam === 'enemy') {
        for (const en of Game.entities.enemies) {
          if (distance(p, en) <= en.radius + (p.radius || 4)) {
            Enemies.takeDamage(en, p.damage);
            this._hitFx(p);
            // 火箭爆炸：对范围内所有敌人造成额外伤害（布洛克超能）
            if (p.explode) {
              for (const en2 of Game.entities.enemies) {
                if (en2 === en) continue;
                if (distance(p, en2) <= p.explode.radius) {
                  Enemies.takeDamage(en2, p.explode.damage);
                }
              }
              for (let k = 0; k < 12; k++) {
                const ang = (k / 12) * Math.PI * 2;
                Game.spawnParticle({ x: p.x, y: p.y, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, life: 0.4, maxLife: 0.4, color: p.color, size: 4 });
              }
            }
            // 杰西子弹弹射：对附近另一敌人造成额外伤害
            if (p.bounce) {
              for (const en2 of Game.entities.enemies) {
                if (en2 === en) continue;
                if (distance(p, en2) <= p.bounce.radius + en2.radius) {
                  Enemies.takeDamage(en2, p.damage * p.bounce.damageRate);
                  break;
                }
              }
            }
            hit = true;
            break;
          }
        }
      } else if (p.targetTeam === 'hero') {
        for (const h of Game.entities.heroes) {
          if (distance(p, h) <= h.radius + (p.radius || 4)) {
            h.hp -= p.damage;
            hit = true;
            break;
          }
        }
      }
      // 超出画面或过期或命中 → 移除
      if (hit || p.life <= 0 || p.y < -20 || p.y > 760 || p.x < -20 || p.x > 500) {
        ps.splice(i, 1);
      }
    }
  },

  /** 创建投射物 */
  spawnProjectile(opts) {
    Game.entities.projectiles.push({
      uid: uid('p'),
      x: opts.x, y: opts.y,
      vx: opts.vx, vy: opts.vy,
      damage: opts.damage,
      radius: opts.radius || 4,
      color: opts.color || '#ffd700',
      life: opts.life || 2,
      targetTeam: opts.targetTeam || 'enemy',
      bounce: opts.bounce || null,
      explode: opts.explode || null
    });
  },

  /** 命中粒子特效 */
  _hitFx(p) {
    for (let i = 0; i < 4; i++) {
      Game.spawnParticle({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.3, maxLife: 0.3,
        color: p.color, size: 2
      });
    }
  },

  /** 方向单位向量 → 速度分量 */
  dirTo(from, to, speed) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return { vx: (dx / d) * speed, vy: (dy / d) * speed };
  }
};
