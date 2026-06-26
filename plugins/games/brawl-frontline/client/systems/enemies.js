/**
 * 敌人系统：生成、AI 移动、攻击、死亡处理
 * - 敌人从顶部中间区域刷新，持续直冲基地（不主动攻击英雄）
 * - 抵达基地前线则攻击基地
 * - Boss 拥有召唤技能
 *
 * 设计意图：敌人不主动打英雄，让英雄能持续输出；威胁来自基地被破
 */
import { Game, LAYOUT } from '../core/game.js';
import { ENEMIES } from '../data/enemies.js';
import { uid, randomRange } from '../core/utils.js';
import { Economy } from './economy.js';

export const Enemies = {
  /** 生成一个敌人（出怪集中在中间区域，便于英雄防御） */
  spawn(enemyId) {
    const data = ENEMIES[enemyId];
    if (!data) return;
    const enemy = {
      uid: uid('en'),
      id: data.id,
      name: data.name,
      x: randomRange(LAYOUT.spawn.x - 130, LAYOUT.spawn.x + 130),
      y: LAYOUT.spawn.y,
      hp: data.hp,
      maxHp: data.hp,
      attack: data.attack,
      range: data.range,
      attackSpeed: data.attackSpeed,
      moveSpeed: data.moveSpeed,
      color: data.color,
      accent: data.accent,
      radius: data.radius,
      goldDrop: data.goldDrop,
      ticketDrop: data.ticketDrop,
      isBoss: !!data.isBoss,
      skill: data.skill || null,
      atkCd: 0,
      skillCd: data.skill ? data.skill.interval : 0
    };
    Game.entities.enemies.push(enemy);
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

  /** 单个敌人 AI：直冲基地，不主动打英雄 */
  _ai(en, dt) {
    en.atkCd = Math.max(0, en.atkCd - dt);
    if (en.skill) en.skillCd = Math.max(0, en.skillCd - dt);

    if (en.y < LAYOUT.baseLine) {
      // 持续向下移动
      en.y += en.moveSpeed * dt;
    } else {
      // 抵达基地前线，攻击基地
      if (en.atkCd <= 0) {
        Game.damageBase(en.attack);
        en.atkCd = 1 / en.attackSpeed;
      }
    }

    // Boss 技能
    if (en.skill && en.skillCd <= 0 && en.skill.type === 'summon') {
      for (let k = 0; k < en.skill.count; k++) {
        this.spawn(en.skill.summonId);
      }
      en.skillCd = en.skill.interval;
    }
  },

  /** 敌人死亡 */
  _onDeath(en) {
    Economy.onKill(en);
    Game.state.kills += 1;
    Game.state.killCounter += 1;
    if (en.isBoss) Game.state.bossKills += 1;
    // 死亡粒子
    for (let i = 0; i < 8; i++) {
      Game.spawnParticle({
        x: en.x, y: en.y,
        vx: randomRange(-60, 60), vy: randomRange(-60, 60),
        life: 0.5, maxLife: 0.5,
        color: en.color, size: 3, gravity: 0
      });
    }
  },

  /** 对某敌人造成伤害 */
  takeDamage(enemy, dmg) {
    enemy.hp -= dmg;
  }
};
