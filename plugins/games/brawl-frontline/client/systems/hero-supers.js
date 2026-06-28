/**
 * 英雄超级技能系统（从 heroes.js 拆分）
 * 类型：cone/barrage/charge/turret/leap/rocket/heal/stun/burst/poison/summon/dash/fire-trail
 * 依赖方向：heroes.js → Supers（单向），Supers 不引用 Heroes
 */
import { Game, LAYOUT } from '../core/game.js';
import { distance, uid, randomRange, angleTo, clamp } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { BoltAI } from './hero-bolt.js';

export const Supers = {
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
      case 'dash': this._dash(h, def); break;
      case 'fire-trail': BoltAI.spawnFireZone(h); break;
    }
  },

  _particleBurst(h) {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: h.y, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, life: 0.5, maxLife: 0.5, color: h.accent, size: 4 });
    }
  },

  /** 雪莉：扇形大量伤害 + 击退 */
  _cone(h, def) {
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d > def.radius) return;
      const ang = angleTo(h, en);
      let diff = ang + Math.PI / 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= def.angle * Math.PI / 180) {
        Enemies.takeDamage(en, def.damage);
        if (def.knockback) {
          en.x = clamp(en.x + Math.cos(ang) * def.knockback, 20, 460);
          en.y = Math.max(40, en.y + Math.sin(ang) * def.knockback);
        }
      }
    });
  },

  /** 柯尔特：三连弹幕 */
  _barrage(h, def) {
    const dmg = h.attack * (def.multiplier || 1);
    for (let i = 0; i < def.shots; i++) {
      const ang = -Math.PI / 2 + randomRange(-0.3, 0.3);
      Combat.spawnProjectile({ x: h.x, y: h.y, vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480, damage: dmg, color: h.accent, radius: 6, life: 1.2 });
    }
  },

  /** 公牛：蛮牛冲撞——朝最近敌人冲刺，路径敌人伤害+击退+击晕 */
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
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      Game.spawnParticle({ x: startX + (endX - startX) * t, y: startY + (endY - startY) * t, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: h.accent, size: 5 });
    }
    h.x = endX; h.y = endY;
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
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      Game.spawnParticle({ x: endX, y: endY, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, life: 0.5, maxLife: 0.5, color: h.accent, size: 4 });
    }
  },

  /** 杰西：召唤炮台（唯一存在：用 h.uid 区分实例，血量清零前不消失） */
  _turret(h, def) {
    if (Game.entities.turrets.some(t => t.ownerId === h.uid)) return;
    Game.entities.turrets.push({
      uid: uid('t'), x: h.x, y: h.y - 40, ownerId: h.uid,
      hp: def.turretHp, maxHp: def.turretHp, damage: def.damage,
      atkCd: 0, color: h.color, range: Math.floor(h.range * 0.5)
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
    for (let i = 0; i < 8; i++) {
      Game.spawnParticle({ x: h.x + (tx - h.x) * (i / 8), y: h.y + (ty - h.y) * (i / 8) - 30, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: h.accent, size: 5 });
    }
    h.x = clamp(tx, 24, 456); h.y = clamp(ty, LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    Game.entities.enemies.forEach(en => {
      if (distance(h, en) <= def.radius) {
        Enemies.takeDamage(en, def.damage);
        en.stunTimer = def.stunDuration;
      }
    });
  },

  /** 布洛克：火箭弹，命中后爆炸范围伤害 */
  _rocket(h, def) {
    Combat.spawnProjectile({ x: h.x, y: h.y, vx: 0, vy: -300, damage: def.damage, color: h.accent, radius: 8, life: 2.5, explode: { radius: def.radius, damage: def.damage } });
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
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: h.y, vx: Math.cos(ang) * 100, vy: Math.sin(ang) * 100, life: 0.4, maxLife: 0.4, color: h.accent, size: 4 });
    }
  },

  /** 斯派克：六向刺球爆发 */
  _spikeBurst(h, def) {
    for (let i = 0; i < def.count; i++) {
      const ang = (i / def.count) * Math.PI * 2;
      Combat.spawnProjectile({ x: h.x, y: h.y, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, damage: def.damage, color: h.accent, radius: 5, life: 1.5 });
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
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: h.y, vx: Math.cos(ang) * 60, vy: Math.sin(ang) * 60, life: 0.8, maxLife: 0.8, color: h.accent, size: 4 });
    }
  },

  /** 塔拉：召唤3个小人（1治疗 + 2攻击），攻击小人索敌机制同英雄 */
  _summon(h, def) {
    for (let i = 0; i < 3; i++) {
      const isHealer = i === 0;
      Game.entities.summons.push({
        uid: uid('s'), x: h.x + (i - 1) * 25, y: h.y - 30,
        hp: def.unitHp, maxHp: def.unitHp, attack: def.unitAttack,
        atkCd: 0, duration: def.duration,
        color: isHealer ? '#06d6a0' : h.color, radius: 12,
        moveSpeed: 70, range: 120, projectileSpeed: 320,
        role: isHealer ? 'healer' : 'attacker',
        heal: isHealer ? (def.unitHeal || 150) : 0
      });
    }
  },

  /** 杰西炮台更新：自动攻击射程内敌人，血量清零才消失 */
  updateTurrets(dt) {
    const ts = Game.entities.turrets;
    const TURRET_RANGE = 100, TURRET_ASPEED = 1.5;  // 杰西 range×50% / attackSpeed×150%
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

  /** 召唤物更新：按角色分发（attacker 追击敌人，healer 治疗受伤英雄），到期消失 */
  updateSummons(dt) {
    const ss = Game.entities.summons;
    for (let i = ss.length - 1; i >= 0; i--) {
      const s = ss[i];
      s.duration -= dt;
      s.atkCd = Math.max(0, s.atkCd - dt);
      if (s.duration <= 0 || s.hp <= 0) { ss.splice(i, 1); continue; }
      if (s.role === 'healer') this._summonHealer(s, dt);
      else this._summonAttacker(s, dt);
    }
  },

  /** 攻击型召唤物：索敌机制同英雄——追击射程内最近敌人，到达射程射击 */
  _summonAttacker(s, dt) {
    let nearest = null, minDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(s, en);
      if (d < minDist) { minDist = d; nearest = en; }
    });
    if (!nearest) return;
    if (minDist > s.range) this._moveTo(s, nearest, dt);
    else if (s.atkCd <= 0) {
      const dir = Combat.dirTo(s, nearest, s.projectileSpeed);
      Combat.spawnProjectile({ x: s.x, y: s.y, vx: dir.vx, vy: dir.vy, damage: s.attack, color: s.color, radius: 4, life: 1.5 });
      s.atkCd = 1.0;
    }
  },

  /** 治疗型召唤物：追击最近受伤英雄，到达范围治疗 */
  _summonHealer(s, dt) {
    let target = null, minDist = Infinity;
    Game.entities.heroes.forEach(h => {
      if (h.hp <= 0 || h.hp >= h.maxHp) return;
      const d = distance(s, h);
      if (d < minDist) { minDist = d; target = h; }
    });
    if (!target) return;
    if (minDist > s.range) this._moveTo(s, target, dt);
    else if (s.atkCd <= 0) {
      target.hp = Math.min(target.maxHp, target.hp + s.heal);
      Game.spawnParticle({ x: target.x, y: target.y - 10, vx: 0, vy: -30, life: 0.5, maxLife: 0.5, color: '#06d6a0', size: 4 });
      s.atkCd = 1.0;
    }
  },

  /** 召唤物通用移动：朝目标按 moveSpeed 前进 */
  _moveTo(s, target, dt) {
    const dx = target.x - s.x, dy = target.y - s.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    s.x += (dx / dd) * s.moveSpeed * dt;
    s.y += (dy / dd) * s.moveSpeed * dt;
  },

  /** 科莱特：冲刺到上方 300 距离并返回，对路径敌人造成百分比伤害 */
  _dash(h, def) {
    const pd = h.percentDamage || def.percentDamage || { rate: 0.34, min: 400, max: 1200 };
    const startY = h.y;
    const endY = Math.max(LAYOUT.heroZone.yMin, h.y - 300);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      Game.spawnParticle({ x: h.x, y: startY + (endY - startY) * t, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: h.accent, size: 5 });
    }
    Game.entities.enemies.forEach(en => {
      if (Math.abs(en.x - h.x) > 40 + en.radius) return;
      if (en.y < endY - 20 || en.y > startY + 20) return;
      const dmg = Math.floor(Math.max(pd.min, Math.min(pd.max, Math.floor(en.hp * pd.rate))));
      Enemies.takeDamage(en, dmg);
    });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      Game.spawnParticle({ x: h.x, y: endY, vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120, life: 0.4, maxLife: 0.4, color: h.accent, size: 4 });
    }
  }
};
