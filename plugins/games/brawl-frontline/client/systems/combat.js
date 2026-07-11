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
            // 杰西子弹弹射：选择距离命中目标最近的另一敌人，生成弹射子弹飞过去造成伤害
            if (p.bounce) {
              let bounceTarget = null, bounceDist = Infinity;
              for (const en2 of Game.entities.enemies) {
                if (en2 === en) continue;
                const d = distance(en, en2); // 以命中敌人为中心搜索
                if (d <= p.bounce.radius + en2.radius && d < bounceDist) {
                  bounceDist = d;
                  bounceTarget = en2;
                }
              }
              if (bounceTarget) {
                // 生成弹射子弹（视觉 + 伤害），从命中敌人飞向目标，不再二次弹射
                const dir = this.dirTo(en, bounceTarget, 320);
                this.spawnProjectile({
                  x: en.x, y: en.y, vx: dir.vx, vy: dir.vy,
                  damage: Math.floor(p.damage * p.bounce.damageRate),
                  color: p.color, radius: 3, life: 0.6,
                  bounce: null
                });
              }
            }
            hit = true;
            break;
          }
        }
      } else if (p.targetTeam === 'hero') {
        for (const ally of [...Game.entities.heroes, ...Game.entities.summons]) {
          if (ally.hp <= 0) continue;
          if (distance(p, ally) <= ally.radius + (p.radius || 4)) {
            ally.hp -= p.damage;
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
  },

  /** 英雄攻击（从 heroes.js 移入，支持百分比伤害：科莱特） */
  heroAttack(h, target) {
    const buffs = Game.systems.buffs;
    h.superCharge = Math.min(1, h.superCharge + h.superDef.chargePerHit * (1 + (buffs ? buffs.superChargeRate() : 0)));
    const boost = Game.systems.facilities ? Game.systems.facilities.getDamageBoost(h) : 0;
    let damage;
    if (h.percentDamage) {
      const pd = h.percentDamage;
      damage = Math.floor(Math.max(pd.min, Math.min(pd.max, Math.floor(target.hp * pd.rate))) * (1 + boost));
    } else {
      damage = Math.floor(h.attack * (1 + boost));
    }
    if (h.projectileSpeed > 0) {
      const dir = this.dirTo(h, target, h.projectileSpeed);
      this.spawnProjectile({ x: h.x, y: h.y, vx: dir.vx, vy: dir.vy, damage, color: h.accent, radius: 5, life: 1.5, bounce: h.bounce || null });
    } else {
      Enemies.takeDamage(target, damage);
    }
  },

  /** 英雄间碰撞分离（防止堆叠，视觉间距约 radius×1.3） */
  separateHeroes() {
    const hs = Game.entities.heroes;
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const a = hs[i], b = hs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = (a.radius + b.radius) * 1.3;
        if (d < minDist) {
          const push = (minDist - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  },

  /** 统计当前锁定指定敌人的英雄数（跨帧分散火力） */
  lockCountOf(enUid) {
    let cnt = 0;
    for (const h of Game.entities.heroes) {
      if (h._targetTimer > 0 && h._targetUid === enUid) cnt++;
    }
    return cnt;
  }
};
