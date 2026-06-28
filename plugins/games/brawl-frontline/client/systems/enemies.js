/**
 * 敌人系统：生成、AI 移动、攻击、死亡处理
 *
 * AI 类型（按 data.ai 字段分发）：
 *   - rusher：直冲基地，抵达后攻击基地（grunt-bot / heavy-bot / shield-guard / mega-pig）
 *   - hunter：追击最近英雄，进入射程后远程射击（gunner-bot）
 *   - bomber：冲向最近英雄，接近后自爆范围伤害（bomber-bot）
 *
 * 特殊机制：shield-guard 减伤 / bomber-bot 自爆 / mega-pig 召唤小怪
 */
import { Game, LAYOUT } from '../core/game.js';
import { ENEMIES } from '../data/enemies.js';
import { uid, randomRange, distance } from '../core/utils.js';
import { Economy } from './economy.js';

/** rusher 对基地的伤害折扣（前期直冲基地敌人对基地伤害太高） */
const BASE_DAMAGE_RATE = 0.6;

export const Enemies = {
  /** 生成敌人（出怪集中在中间区域，根据波数应用难度系数） */
  spawn(enemyId) {
    const data = ENEMIES[enemyId];
    if (!data) return;
    const wave = Game.state.wave || 1;
    const m = this._difficultyMult(wave);
    const hp = Math.floor(data.hp * m.hp);
    const enemy = {
      uid: uid('en'),
      id: data.id,
      name: data.name,
      x: randomRange(LAYOUT.spawn.x - 130, LAYOUT.spawn.x + 130),
      y: LAYOUT.spawn.y,
      hp,
      maxHp: hp,
      attack: Math.floor(data.attack * m.atk),
      range: data.range,
      attackSpeed: data.attackSpeed,
      moveSpeed: Math.floor(data.moveSpeed * m.spd),
      color: data.color,
      accent: data.accent,
      radius: data.radius,
      goldDrop: data.goldDrop,
      ticketDrop: data.ticketDrop,
      isBoss: !!data.isBoss,
      skill: data.skill || null,
      ai: data.ai || 'rusher',
      damageReduction: data.damageReduction || 0,
      slowTimer: 0,        // 减速剩余时间（公牛超能）
      slowRate: 1,         // 减速比例（1=正常，0.5=射速减半）
      stunTimer: 0,        // 眩晕剩余时间（弗兰肯/普里莫超能）
      poisonTimer: 0,      // 中毒剩余时间（乌鸦超能）
      poisonDps: 0,        // 中毒每秒伤害
      shieldHp: 0,         // 护盾吸收量（护盾Boss技能）
      shieldDuration: 0,   // 护盾剩余时间
      enraged: false,      // 是否已狂暴（狂暴Boss被动）
      atkCd: 0,
      skillCd: data.skill ? data.skill.interval : 0
    };
    Game.entities.enemies.push(enemy);
  },

  /** 波次难度系数：第 1 波大幅削弱，第 4 波起标准，无尽模式指数级递增
   *  增长率调低（hp 1.25 / atk 1.18），让玩家能坚持到 20 波 */
  _difficultyMult(wave) {
    if (wave <= 1) return { hp: 0.35, atk: 0.45, spd: 0.6 };
    if (wave === 2) return { hp: 0.6, atk: 0.7, spd: 0.8 };
    if (wave === 3) return { hp: 0.8, atk: 0.85, spd: 0.9 };
    if (wave <= 6) return { hp: 1.0, atk: 1.0, spd: 1.0 };
    // 无尽模式：增长率调低，第 20 波 hp ×1.25^14≈22.7（原 1.30^14≈39.5）
    const extra = wave - 6;
    return {
      hp: Math.pow(1.25, extra),
      atk: Math.pow(1.18, extra),
      spd: 1.0 + extra * 0.02
    };
  },

  update(dt) {
    const enemies = Game.entities.enemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      this._ai(en, dt);
      if (en.hp <= 0) {
        this._onDeath(en);
        enemies.splice(i, 1);
      }
    }
  },

  /** AI 分发器：减速/眩晕/中毒状态机 + 按 ai 字段分发 */
  _ai(en, dt) {
    // 中毒持续伤害（独立于行动，即使被眩晕也扣血）
    if (en.poisonTimer > 0) {
      en.poisonTimer -= dt;
      en.hp -= (en.poisonDps || 0) * dt;
    }
    // 狂暴被动：血量低于阈值时触发（仅一次，眩晕中也会触发）
    if (en.skill && en.skill.type === 'enrage' && !en.enraged && en.hp > 0) {
      if (en.hp / en.maxHp < en.skill.threshold) {
        en.enraged = true;
        en.attack = Math.floor(en.attack * en.skill.atkBoost);
        en.moveSpeed = Math.floor(en.moveSpeed * en.skill.spdBoost);
        // 狂暴粒子特效
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          Game.spawnParticle({ x: en.x, y: en.y, vx: Math.cos(ang) * 100, vy: Math.sin(ang) * 100, life: 0.6, maxLife: 0.6, color: '#ff0000', size: 4 });
        }
      }
    }
    // 护盾技能：周期性激活伤害吸收护盾
    if (en.skill && en.skill.type === 'shield') {
      if (en.shieldDuration > 0) {
        en.shieldDuration -= dt;
        if (en.shieldDuration <= 0) en.shieldHp = 0;
      } else if (en.skillCd <= 0) {
        en.shieldHp = en.skill.shieldHp;
        en.shieldDuration = en.skill.duration;
        en.skillCd = en.skill.interval;
      }
    }
    // 眩晕：无法行动，仅扣减眩晕时间
    if (en.stunTimer > 0) {
      en.stunTimer -= dt;
      return;
    }
    let spdMult = 1;
    if (en.slowTimer > 0) {
      en.slowTimer -= dt;
      spdMult = en.slowRate || 1;
    }
    en.atkCd = Math.max(0, en.atkCd - dt * spdMult);
    if (en.skill) en.skillCd = Math.max(0, en.skillCd - dt);

    switch (en.ai) {
      case 'hunter': this._aiHunter(en, dt); break;
      case 'bomber': this._aiBomber(en, dt); break;
      default: this._aiRusher(en, dt); break;
    }

    // Boss 召唤技能
    if (en.skill && en.skillCd <= 0 && en.skill.type === 'summon') {
      for (let k = 0; k < en.skill.count; k++) this.spawn(en.skill.summonId);
      en.skillCd = en.skill.interval;
    }
  },

  /** rusher AI：直冲基地，碰到挡路设施/杰西炮台先打掉，抵达基地前线后按优先级攻击：
   *   杰西炮台 > 守家英雄（坦克/治疗） > 玩家设施 > 基地（伤害按 BASE_DAMAGE_RATE 折扣）
   *   搜索范围 120（rusher 原射程仅 50，需扩大以实现"优先攻击炮台/守家英雄"） */
  _aiRusher(en, dt) {
    // 移动中碰到挡路设施或杰西炮台：优先攻击
    for (const f of Game.buildings.facilities) {
      if (f && distance(en, f) <= en.radius + f.radius) {
        if (en.atkCd <= 0) { Game.systems.facilities.takeDamage(f, en.attack); en.atkCd = 1 / en.attackSpeed; }
        return;
      }
    }
    for (const t of Game.entities.turrets) {
      if (distance(en, t) <= en.radius + t.radius + 5) {
        if (en.atkCd <= 0) { t.hp -= en.attack; en.atkCd = 1 / en.attackSpeed; }
        return;
      }
    }
    if (en.y < LAYOUT.baseLine) { en.y += en.moveSpeed * dt; }
    // 全程搜索炮台/守家英雄：发现就主动靠近攻击（不等到抵达基地前线）
    const prio = this._nearestTurret(en) || this._nearestGuardHero(en);
    if (prio) {
      const d = distance(en, prio);
      if (d <= en.range + prio.radius) {
        if (en.atkCd <= 0) { prio.hp -= en.attack; en.atkCd = 1 / en.attackSpeed; }
      } else {
        // 目标在搜索范围内但不在攻击范围：主动靠近
        const dx = prio.x - en.x, dy = prio.y - en.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
        en.x += (dx / dd) * en.moveSpeed * dt;
        en.y += (dy / dd) * en.moveSpeed * dt;
      }
      return;
    }
    if (en.y < LAYOUT.baseLine) return;
    if (en.atkCd > 0) return;
    let tf = null, minD = Infinity;
    for (const f of Game.buildings.facilities) {
      if (!f) continue;
      const d = distance(en, f);
      if (d <= (f.range || 0) + f.radius && d < minD) { minD = d; tf = f; }
    }
    if (tf) Game.systems.facilities.takeDamage(tf, en.attack);
    else Game.damageBase(en.attack * BASE_DAMAGE_RATE);
    en.atkCd = 1 / en.attackSpeed;
  },

  /** 查找 120 范围内最近的杰西炮台，用于 rusher 优先攻击 */
  _nearestTurret(en) {
    const AGGRO = 120;
    let nearest = null, minDist = Infinity;
    for (const t of Game.entities.turrets) {
      const d = distance(en, t);
      if (d <= AGGRO + t.radius && d < minDist) { minDist = d; nearest = t; }
    }
    return nearest;
  },

  /** 查找 120 范围内的守家型英雄（坦克/治疗），用于 rusher 优先攻击 */
  _nearestGuardHero(en) {
    const AGGRO = 120;
    let nearest = null, minDist = Infinity;
    for (const h of Game.entities.heroes) {
      if (h.hp <= 0) continue;
      if (h.role !== '坦克' && h.role !== '治疗') continue;
      const d = distance(en, h);
      if (d <= AGGRO + h.radius && d < minDist) { minDist = d; nearest = h; }
    }
    return nearest;
  },

  /** hunter AI：追击最近英雄，进入射程后远程射击 */
  _aiHunter(en, dt) {
    const target = this._nearestHero(en);
    if (!target) { this._aiRusher(en, dt); return; }
    const dist = distance(en, target);
    if (dist > en.range) {
      const dx = target.x - en.x, dy = target.y - en.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      en.x += (dx / d) * en.moveSpeed * dt;
      en.y += (dy / d) * en.moveSpeed * dt;
    } else if (en.atkCd <= 0) {
      const dx = target.x - en.x, dy = target.y - en.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      Game.systems.combat.spawnProjectile({
        x: en.x, y: en.y,
        vx: (dx / d) * 220, vy: (dy / d) * 220,
        damage: en.attack, color: en.color,
        radius: 5, life: 2, targetTeam: 'hero'
      });
      en.atkCd = 1 / en.attackSpeed;
    }
  },

  /** bomber AI：冲向最近英雄，接近后自爆 */
  _aiBomber(en, dt) {
    const target = this._nearestHero(en);
    if (!target) { this._aiRusher(en, dt); return; }
    const dist = distance(en, target);
    if (dist <= en.range) {
      en.hp = 0;
    } else {
      const dx = target.x - en.x, dy = target.y - en.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      en.x += (dx / d) * en.moveSpeed * dt;
      en.y += (dy / d) * en.moveSpeed * dt;
    }
  },

  /** 查找最近存活英雄 */
  _nearestHero(en) {
    let nearest = null, minDist = Infinity;
    for (const h of Game.entities.heroes) {
      if (h.hp <= 0) continue;
      const d = distance(en, h);
      if (d < minDist) { minDist = d; nearest = h; }
    }
    return nearest;
  },

  /** 敌人死亡 */
  _onDeath(en) {
    Economy.onKill(en);
    Game.state.kills += 1;
    Game.state.killCounter += 1;
    if (en.isBoss) Game.state.bossKills += 1;
    if (en.ai === 'bomber') this._explode(en);
    for (let i = 0; i < 8; i++) {
      Game.spawnParticle({
        x: en.x, y: en.y,
        vx: randomRange(-60, 60), vy: randomRange(-60, 60),
        life: 0.5, maxLife: 0.5,
        color: en.color, size: 3, gravity: 0
      });
    }
  },

  /** 爆破兵自爆：范围伤害英雄 + 基地 + 爆炸特效 */
  _explode(en) {
    const r = en.range;
    for (const h of Game.entities.heroes) {
      if (h.hp <= 0) continue;
      if (distance(en, h) <= r) h.hp -= en.attack;
    }
    if (Math.abs(en.y - LAYOUT.base.y) < r + LAYOUT.base.h / 2) {
      Game.damageBase(Math.floor(en.attack * 0.5));
    }
    for (let i = 0; i < 16; i++) {
      Game.spawnParticle({
        x: en.x, y: en.y,
        vx: randomRange(-200, 200), vy: randomRange(-200, 200),
        life: 0.6, maxLife: 0.6,
        color: '#ff6b35', size: 4, gravity: 0
      });
    }
  },

  /** 对某敌人造成伤害（护盾优先吸收 → 盾卫减伤 → 本体扣血） */
  takeDamage(enemy, dmg) {
    if (enemy.shieldHp > 0) {
      enemy.shieldHp -= dmg;
      if (enemy.shieldHp < 0) {
        enemy.hp += enemy.shieldHp;  // 溢出伤害打到本体
        enemy.shieldHp = 0;
      }
      return;
    }
    const reduction = enemy.damageReduction || 0;
    enemy.hp -= dmg * (1 - reduction);
  }
};
