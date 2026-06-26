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

export const Supers = {
  /** 超能释放入口 */
  release(h) {
    this._particleBurst(h);
    h.superFlash = 0.5;
    const def = h.superDef;
    switch (def.type) {
      case 'cone': this._cone(h, def); break;
      case 'barrage': this._barrage(h, def); break;
      case 'slow': this._slow(h, def); break;
      case 'turret': this._turret(h, def); break;
      case 'leap': this._leap(h, def); break;
      case 'rocket': this._rocket(h, def); break;
      case 'heal': this._heal(h, def); break;
      case 'stun': this._stun(h, def); break;
      case 'burst': this._spikeBurst(h, def); break;
      case 'poison': this._poison(h, def); break;
      case 'summon': this._summon(h, def); break;
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

  /** 公牛：威慑怒吼，减缓最近敌人射速 */
  _slow(h, def) {
    let nearest = null, minDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < def.radius && d < minDist) { minDist = d; nearest = en; }
    });
    if (nearest) { nearest.slowTimer = def.duration; nearest.slowRate = def.slowRate; }
  },

  /** 杰西：召唤炮台 */
  _turret(h, def) {
    Game.entities.turrets.push({
      uid: uid('t'), x: h.x, y: h.y - 40,
      hp: def.turretHp, maxHp: def.turretHp, damage: def.damage,
      atkCd: 0, duration: def.duration, color: h.color
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

  /** 炮台更新：自动攻击射程内敌人，到期消失 */
  updateTurrets(dt) {
    const ts = Game.entities.turrets;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.duration -= dt;
      t.atkCd = Math.max(0, t.atkCd - dt);
      if (t.duration <= 0 || t.hp <= 0) { ts.splice(i, 1); continue; }
      if (t.atkCd <= 0) {
        let nearest = null, minDist = Infinity;
        Game.entities.enemies.forEach(en => {
          const d = distance(t, en);
          if (d < 180 && d < minDist) { minDist = d; nearest = en; }
        });
        if (nearest) {
          const dir = Combat.dirTo(t, nearest, 380);
          Combat.spawnProjectile({ x: t.x, y: t.y, vx: dir.vx, vy: dir.vy, damage: t.damage, color: t.color, radius: 4, life: 1.5 });
          t.atkCd = 1.0;
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
