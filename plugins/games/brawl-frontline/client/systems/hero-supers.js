/**
 * 英雄超级技能系统（从 heroes.js 拆分，避免主系统文件超 300 行）
 * 11 种超能类型：cone / barrage / slow / turret / leap / rocket / heal / stun / burst / poison / summon
 *
 * 依赖方向：heroes.js → Supers（单向），Supers 不引用 Heroes，直接操作英雄数据
 * - release(h)：超能释放入口，按 def.type 分发
 * - updateTurrets(dt)：杰西炮台自动攻击
 * - updateSummons(dt)：塔拉召唤物追击敌人
 */
import { Game, LAYOUT } from '../core/game.js';
import { distance, uid, randomRange, angleTo, clamp } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { BoltAI } from './hero-bolt.js';

export const Supers = {
  /** 超能释放入口 */
  release(h) {
    this._particleBurst(h);
    h.superFlash = 0.5;
    const def = h.superDef;
    switch (def.type) {
      case 'cone': this._cone(h, def); break;
      case 'barrage': this._barrage(h, def); break;
      case 'charge': this._charge(h, def); break;
      case 'turret': this._turret(h, def); break;
      case 'leap': this._leap(h, def); break;
      case 'rocket': this._rocket(h, def); break;
      case 'heal': this._heal(h, def); break;
      case 'stun': this._stun(h, def); break;
      case 'burst': this._spikeBurst(h, def); break;
      case 'poison': this._poison(h, def); break;
      case 'summon': this._summon(h, def); break;
      case 'fire-trail': BoltAI.spawnFireZone(h); break;
    }
  },

  /** 释放时的粒子爆发特效 */
  _particleBurst(h) {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      Game.spawnParticle({
        x: h.x, y: h.y,
        vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120,
        life: 0.5, maxLife: 0.5, color: h.accent, size: 4
      });
    }
  },

  /** 雪莉：扇形大量伤害 + 击退 */
  _cone(h, def) {
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d > def.radius) return;
      const ang = angleTo(h, en);
      const targetAng = -Math.PI / 2;
      let diff = ang - targetAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= def.angle * Math.PI / 180) {
        Enemies.takeDamage(en, def.damage);
        if (def.knockback) {
          en.x += Math.cos(ang) * def.knockback;
          en.y += Math.sin(ang) * def.knockback;
          en.x = clamp(en.x, 20, 460);
          en.y = Math.max(40, en.y);
        }
      }
    });
  },

  /** 柯尔特：三连弹幕，伤害 = 普攻 × multiplier */
  _barrage(h, def) {
    const dmg = h.attack * (def.multiplier || 1);
    for (let i = 0; i < def.shots; i++) {
      const ang = -Math.PI / 2 + randomRange(-0.3, 0.3);
      Combat.spawnProjectile({
        x: h.x, y: h.y, vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
        damage: dmg, color: h.accent, radius: 6, life: 1.2
      });
    }
  },

  /** 公牛：蛮牛冲撞——朝最近敌人冲刺，对路径上敌人造成伤害+击退+击晕 */
  _charge(h, def) {
    const startX = h.x, startY = h.y;
    let nearest = null, minDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < minDist) { minDist = d; nearest = en; }
    });
    const dx = nearest ? nearest.x - h.x : 0;
    const dy = nearest ? nearest.y - h.y : -1;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const endX = clamp(startX + (dx / d) * def.distance, 24, 456);
    const endY = clamp(startY + (dy / d) * def.distance, LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    // 路径粒子轨迹
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      Game.spawnParticle({
        x: startX + (endX - startX) * t, y: startY + (endY - startY) * t,
        vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: h.accent, size: 5
      });
    }
    h.x = endX; h.y = endY;
    // 路径附近敌人：伤害 + 击退 + 击晕
    const segDx = endX - startX, segDy = endY - startY;
    const segLen2 = segDx * segDx + segDy * segDy || 1;
    Game.entities.enemies.forEach(en => {
      const proj = Math.max(0, Math.min(1, ((en.x - startX) * segDx + (en.y - startY) * segDy) / segLen2));
      const cx = startX + segDx * proj, cy = startY + segDy * proj;
      if (distance(en, { x: cx, y: cy }) <= def.radius + en.radius) {
        Enemies.takeDamage(en, def.damage);
        en.x = clamp(en.x + (dx / d) * def.knockback, 20, 460);
        en.y = Math.max(40, en.y + (dy / d) * def.knockback);
        en.stunTimer = def.stunDuration;
      }
    });
    // 终点冲击波特效
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      Game.spawnParticle({ x: endX, y: endY, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, life: 0.5, maxLife: 0.5, color: h.accent, size: 4 });
    }
  },

  /** 杰西：召唤炮台（唯一存在：一个杰西同时只能有一个炮台，血量未清零不消失）
   *  射程 = 杰西 range ×50% = 100，攻速 = 杰西 attackSpeed ×150% = 1.5 */
  _turret(h, def) {
    // 该杰西实例已有存活炮台则不再放置（用 uid 区分同类型多个杰西）
    if (Game.entities.turrets.some(t => t.ownerId === h.uid)) return;
    Game.entities.turrets.push({
      uid: uid('t'), x: h.x, y: h.y - 40,
      ownerId: h.uid,                    // 绑定召唤者实例，用于唯一性检查
      hp: def.turretHp, maxHp: def.turretHp, damage: def.damage,
      atkCd: 0, color: h.color,
      range: Math.floor(h.range * 0.5)   // 杰西 range × 50%
    });
  },

  /** 艾尔普里莫：跳跃到最近敌人位置，造成范围伤害 + 眩晕 */
  _leap(h, def) {
    let nearest = null, minDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < minDist) { minDist = d; nearest = en; }
    });
    const tx = nearest ? nearest.x : h.x;
    const ty = nearest ? Math.max(nearest.y - 30, LAYOUT.heroZone.yMin) : h.y - 60;
    // 跳跃轨迹粒子
    for (let i = 0; i < 8; i++) {
      Game.spawnParticle({
        x: h.x + (tx - h.x) * (i / 8), y: h.y + (ty - h.y) * (i / 8) - 30,
        vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: h.accent, size: 5
      });
    }
    h.x = clamp(tx, 24, 456); h.y = clamp(ty, LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    // 落地范围伤害 + 眩晕
    Game.entities.enemies.forEach(en => {
      if (distance(h, en) <= def.radius) {
        Enemies.takeDamage(en, def.damage);
        en.stunTimer = def.stunDuration;
      }
    });
  },

  /** 布洛克：发射火箭弹，命中后爆炸范围伤害 */
  _rocket(h, def) {
    Combat.spawnProjectile({
      x: h.x, y: h.y, vx: 0, vy: -300,
      damage: def.damage, color: h.accent, radius: 8, life: 2.5,
      explode: { radius: def.radius, damage: def.damage }
    });
  },

  /** 帕姆/波克：治疗自身 + 范围内友军 */
  _heal(h, def) {
    h.hp = Math.min(h.maxHp, h.hp + def.heal);
    Game.entities.heroes.forEach(ally => {
      if (ally === h || ally.hp <= 0) return;
      if (distance(h, ally) <= def.radius) {
        ally.hp = Math.min(ally.maxHp, ally.hp + def.heal);
        Game.spawnParticle({ x: ally.x, y: ally.y - 10, vx: 0, vy: -30, life: 0.5, maxLife: 0.5, color: '#06d6a0', size: 4 });
      }
    });
    Game.spawnParticle({ x: h.x, y: h.y - 10, vx: 0, vy: -30, life: 0.5, maxLife: 0.5, color: '#06d6a0', size: 5 });
  },

  /** 弗兰肯：范围眩晕 */
  _stun(h, def) {
    Game.entities.enemies.forEach(en => {
      if (distance(h, en) <= def.radius) en.stunTimer = def.duration;
    });
    // 眩晕冲击波特效
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: h.y, vx: Math.cos(ang) * 100, vy: Math.sin(ang) * 100, life: 0.4, maxLife: 0.4, color: h.accent, size: 4 });
    }
  },

  /** 斯派克：六向刺球爆发 */
  _spikeBurst(h, def) {
    for (let i = 0; i < def.count; i++) {
      const ang = (i / def.count) * Math.PI * 2;
      Combat.spawnProjectile({
        x: h.x, y: h.y, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300,
        damage: def.damage, color: h.accent, radius: 5, life: 1.5
      });
    }
  },

  /** 乌鸦：对范围内敌人施加中毒 */
  _poison(h, def) {
    Game.entities.enemies.forEach(en => {
      if (distance(h, en) <= def.radius) {
        en.poisonTimer = def.duration;
        en.poisonDps = def.dps;
      }
    });
    // 毒云粒子
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: h.y, vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, life: 0.8, maxLife: 0.8, color: h.accent, size: 4 });
    }
  },

  /** 塔拉：召唤友方战斗单位 */
  _summon(h, def) {
    Game.entities.summons.push({
      uid: uid('s'), x: h.x, y: h.y - 30,
      hp: def.unitHp, maxHp: def.unitHp, attack: def.unitAttack,
      atkCd: 0, duration: def.duration, color: h.color, radius: 14,
      moveSpeed: 60, range: 80, projectileSpeed: 300
    });
  },

  /** 杰西炮台更新：自动攻击射程内敌人，血量清零才消失（无持续时间限制）
   *  属性：射程 = 杰西 range ×50% = 100，攻速 = 杰西 attackSpeed ×150% = 1.5 */
  updateTurrets(dt) {
    const ts = Game.entities.turrets;
    const TURRET_RANGE = 100;   // 杰西 range(200) × 50%
    const TURRET_ASPEED = 1.5;  // 杰西 attackSpeed(1.0) × 150%
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.atkCd = Math.max(0, t.atkCd - dt);
      if (t.hp <= 0) { ts.splice(i, 1); continue; }
      if (t.atkCd <= 0) {
        let nearest = null, minDist = Infinity;
        Game.entities.enemies.forEach(en => {
          const d = distance(t, en);
          if (d < TURRET_RANGE && d < minDist) { minDist = d; nearest = en; }
        });
        if (nearest) {
          const dir = Combat.dirTo(t, nearest, 380);
          Combat.spawnProjectile({ x: t.x, y: t.y, vx: dir.vx, vy: dir.vy, damage: t.damage, color: t.color, radius: 4, life: 1.5 });
          t.atkCd = 1 / TURRET_ASPEED;
        }
      }
    }
  },

  /** 召唤物更新：追击敌人并攻击，到期消失 */
  updateSummons(dt) {
    const ss = Game.entities.summons;
    for (let i = ss.length - 1; i >= 0; i--) {
      const s = ss[i];
      s.duration -= dt;
      s.atkCd = Math.max(0, s.atkCd - dt);
      if (s.duration <= 0 || s.hp <= 0) { ss.splice(i, 1); continue; }
      let nearest = null, minDist = Infinity;
      Game.entities.enemies.forEach(en => {
        const d = distance(s, en);
        if (d < minDist) { minDist = d; nearest = en; }
      });
      if (!nearest) continue;
      const d = minDist;
      if (d > s.range) {
        const dx = nearest.x - s.x, dy = nearest.y - s.y;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        s.x += (dx / dd) * s.moveSpeed * dt;
        s.y += (dy / dd) * s.moveSpeed * dt;
      } else if (s.atkCd <= 0) {
        const dir = Combat.dirTo(s, nearest, s.projectileSpeed);
        Combat.spawnProjectile({ x: s.x, y: s.y, vx: dir.vx, vy: dir.vy, damage: s.attack, color: s.color, radius: 4, life: 1.5 });
        s.atkCd = 1.0;
      }
    }
  }
};
