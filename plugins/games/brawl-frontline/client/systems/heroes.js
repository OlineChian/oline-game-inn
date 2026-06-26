/**
 * 英雄系统：招募、升级星级、AI、超级技能释放
 * - 全局升星：同种类英雄共享星级（state.heroStars[id]），新招募即带当前星级
 * - 超级技能：3 星及以上解锁（1/2 星可充能但不释放）
 * - 近战英雄（projectileSpeed===0）主动追击敌人，可横向追两侧敌人
 * - 远程英雄守在基地附近，攻击射程内敌人
 * - 4 种超级技能：cone 扇形 / barrage 弹幕 / charge 冲锋 / turret 召唤炮台
 */
import { Game, LAYOUT } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR } from '../data/heroes.js';
import { distance, uid, randomRange, angleTo, clamp } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { Buffs } from './buffs.js';

export const Heroes = {
  /** 招募英雄（消耗英雄券，可重复招募同种英雄，新招募带当前全局星级） */
  recruit(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return false;
    if (Game.state.tickets < (data.cost.tickets || 1)) return false;
    Game.state.tickets -= data.cost.tickets || 1;
    const hero = this._create(data);
    Game.entities.heroes.push(hero);
    return true;
  },

  /** 起始英雄（3选1，免费） */
  recruitStarter(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return false;
    const hero = this._create(data);
    Game.entities.heroes.push(hero);
    Game.state.selectedHero = heroId;
    return true;
  },

  _create(data) {
    // 全局星级：新招募即带当前星级（默认 1）
    const star = Game.state.heroStars[data.id] || 1;
    const hero = {
      uid: uid('h'),
      id: data.id, name: data.name, role: data.role, faction: data.faction,
      star: star,
      x: LAYOUT.base.x + randomRange(-50, 50),
      y: LAYOUT.base.y - 80,
      baseHp: data.hp, baseAttack: data.attack,
      range: data.range, attackSpeed: data.attackSpeed,
      moveSpeed: data.moveSpeed,
      projectileSpeed: data.projectileSpeed,
      color: data.color, accent: data.accent,
      radius: 16,
      superDef: data.super,
      superCharge: 0,
      atkCd: 0,
      hp: data.hp, maxHp: data.hp, attack: data.attack,
      superFlash: 0  // 超能释放高亮计时（>0 时渲染器加亮）
    };
    this._applyStar(hero);
    return hero;
  },

  /** 升级星级（消耗金币，全局升星：同 id 所有英雄同步升级） */
  upgradeStar(heroId) {
    const curStar = Game.state.heroStars[heroId] || 1;
    if (curStar >= 5) return false;
    const cost = STAR_UPGRADE_COST[curStar - 1];
    if (Game.state.gold < cost) return false;
    Game.state.gold -= cost;
    Game.state.heroStars[heroId] = curStar + 1;
    // 同步所有同 id 英雄实例
    Game.entities.heroes.forEach(h => {
      if (h.id === heroId) {
        h.star = curStar + 1;
        this._applyStar(h);
      }
    });
    return true;
  },

  /** 获取某英雄种类的当前全局星级 */
  getStar(heroId) {
    return Game.state.heroStars[heroId] || 1;
  },

  /** 按星级 + buff 重算属性 */
  _applyStar(hero) {
    const hpRate = Buffs.heroHpRate();
    const atkRate = Buffs.heroAtkRate();
    const aspdRate = Buffs.heroAspdRate();
    hero.maxHp = Math.floor(hero.baseHp * Math.pow(STAR_GROWTH.hp, hero.star - 1) * (1 + hpRate));
    hero.attack = Math.floor(hero.baseAttack * Math.pow(STAR_GROWTH.attack, hero.star - 1) * (1 + atkRate));
    hero.effectiveAspd = hero.attackSpeed * (1 + aspdRate);
    hero.hp = hero.maxHp;
  },

  update(dt) {
    const heroes = Game.entities.heroes;
    for (let i = heroes.length - 1; i >= 0; i--) {
      const h = heroes[i];
      this._ai(h, dt);
      // 超能高亮倒计时
      if (h.superFlash > 0) h.superFlash = Math.max(0, h.superFlash - dt);
      if (h.hp <= 0) {
        for (let k = 0; k < 10; k++) {
          Game.spawnParticle({
            x: h.x, y: h.y,
            vx: randomRange(-80, 80), vy: randomRange(-80, 80),
            life: 0.6, maxLife: 0.6, color: h.color, size: 3
          });
        }
        heroes.splice(i, 1);
      }
    }
  },

  _ai(h, dt) {
    h.atkCd = Math.max(0, h.atkCd - dt);
    const isMelee = h.projectileSpeed === 0;
    const target = this._findEnemy(h);
    if (target) {
      if (h.atkCd <= 0) {
        this._attack(h, target);
        h.atkCd = 1 / h.effectiveAspd;
      }
    } else if (isMelee) {
      // 近战英雄主动寻敌：追最近敌人（含横向追击两侧敌人）
      const nearest = this._nearestEnemy(h);
      if (nearest) {
        const dx = nearest.x - h.x;
        const dy = nearest.y - h.y;
        if (Math.abs(dx) > 4) h.x += Math.sign(dx) * h.moveSpeed * dt;
        if (dy < -10 && h.y > LAYOUT.heroZone.yMin) h.y -= h.moveSpeed * dt * 0.8;
        else if (dy > 10 && h.y < LAYOUT.heroZone.yMax) h.y += h.moveSpeed * dt * 0.5;
      } else if (h.y > LAYOUT.heroZone.yMin) {
        h.y -= h.moveSpeed * dt;
      }
    } else {
      // 远程英雄：横向追击最近敌人，保持基地附近
      const nearest = this._nearestEnemy(h);
      if (nearest) {
        const dx = nearest.x - h.x;
        if (Math.abs(dx) > 4) h.x += Math.sign(dx) * h.moveSpeed * dt;
        if (h.y > LAYOUT.heroZone.yMin) h.y -= h.moveSpeed * dt * 0.4;
      } else if (h.y > LAYOUT.heroZone.yMin) {
        h.y -= h.moveSpeed * dt;
      }
    }
    // 限制英雄在画布内
    h.x = clamp(h.x, 24, VIEW_W - 24);
    h.y = clamp(h.y, LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    // 超能充能满 + 3 星解锁 → 释放
    if (h.superCharge >= 1 && h.star >= SUPER_UNLOCK_STAR) {
      this._releaseSuper(h);
      h.superCharge = 0;
    } else if (h.superCharge >= 1 && h.star < SUPER_UNLOCK_STAR) {
      // 未解锁时封顶在 1.0，等升星后立即释放
      h.superCharge = 1;
    }
  },

  _findEnemy(h) {
    let best = null;
    let bestDist = h.range + h.radius + 20;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  _nearestEnemy(h) {
    let best = null;
    let bestDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  _attack(h, target) {
    const chargeGain = h.superDef.chargePerHit * (1 + Buffs.superChargeRate());
    h.superCharge = Math.min(1, h.superCharge + chargeGain);
    if (h.projectileSpeed > 0) {
      const dir = Combat.dirTo(h, target, h.projectileSpeed);
      Combat.spawnProjectile({
        x: h.x, y: h.y, vx: dir.vx, vy: dir.vy,
        damage: h.attack, color: h.accent, radius: 5, life: 1.5
      });
    } else {
      Enemies.takeDamage(target, h.attack);
    }
  },

  /** 释放超级技能：粒子爆发 + 英雄高亮（无文字提示） */
  _releaseSuper(h) {
    this._superBurst(h);
    h.superFlash = 0.5;  // 0.5 秒高亮
    const def = h.superDef;
    switch (def.type) {
      case 'cone': this._superCone(h, def); break;
      case 'barrage': this._superBarrage(h, def); break;
      case 'charge': this._superCharge(h, def); break;
      case 'turret': this._superTurret(h, def); break;
    }
  },

  /** 超级技能释放爆发粒子 */
  _superBurst(h) {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      Game.spawnParticle({
        x: h.x, y: h.y,
        vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120,
        life: 0.5, maxLife: 0.5, color: h.accent, size: 4
      });
    }
  },

  _superCone(h, def) {
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d <= def.radius) {
        const ang = angleTo(h, en);
        const targetAng = -Math.PI / 2;
        let diff = ang - targetAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= def.angle * Math.PI / 180) {
          Enemies.takeDamage(en, def.damage);
        }
      }
    });
  },

  _superBarrage(h, def) {
    for (let i = 0; i < def.shots; i++) {
      const spread = randomRange(-0.3, 0.3);
      const ang = -Math.PI / 2 + spread;
      Combat.spawnProjectile({
        x: h.x, y: h.y,
        vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
        damage: def.damage, color: h.accent, radius: 6, life: 1.2
      });
    }
  },

  _superCharge(h, def) {
    const startY = h.y;
    h.y = Math.max(LAYOUT.heroZone.yMin, h.y - def.distance);
    Game.entities.enemies.forEach(en => {
      if (en.y >= h.y && en.y <= startY + 20 && Math.abs(en.x - h.x) < 40) {
        Enemies.takeDamage(en, def.damage);
      }
    });
  },

  _superTurret(h, def) {
    Game.entities.turrets.push({
      uid: uid('t'),
      x: h.x, y: h.y - 40,
      hp: def.turretHp, maxHp: def.turretHp,
      damage: def.damage,
      atkCd: 0,
      duration: def.duration,
      color: h.color
    });
  }
};

/** 逻辑画布宽度（用于边界 clamp，从 game.js VIEW 导入避免循环依赖） */
const VIEW_W = 480;
