/**
 * C 类战场设施系统：建造、更新、攻击/治疗/光环
 * - attacker：自动攻击射程内敌人（炮台/舰炮）
 * - healer：周期性治疗范围内英雄（治疗台）
 * - booster：光环效果，范围内英雄伤害提升（伤害放大器）
 * - 设施有独立 hp，被敌人攻击至 0 后消失，可重建
 */
import { Game, LAYOUT } from '../core/game.js';
import { FACILITIES } from '../data/facilities.js';
import { uid, distance } from '../core/utils.js';

export const Facilities = {
  /** 在指定建造位建造设施（消耗金币）
   *  设施血量 = 基地当前血量 × hpRate（attacker=1.0，healer/booster=1.5） */
  build(slotIndex, facilityId) {
    const data = FACILITIES[facilityId];
    if (!data) return { ok: false, msg: '无效设施' };
    if (slotIndex < 0 || slotIndex >= LAYOUT.facilitySlots.length) return { ok: false, msg: '无效建造位' };
    if (Game.buildings.facilities[slotIndex]) return { ok: false, msg: '该位置已有设施' };
    if (Game.state.gold < data.cost) return { ok: false, msg: '金币不足' };
    Game.state.gold -= data.cost;
    const slot = LAYOUT.facilitySlots[slotIndex];
    const hp = Math.floor(Game.state.baseHp * (data.hpRate || 1));
    Game.buildings.facilities[slotIndex] = {
      uid: uid('f'),
      id: data.id, name: data.name, type: data.type,
      slot: slotIndex,
      x: slot.x, y: slot.y,
      hp, maxHp: hp,
      damage: data.damage || 0,
      range: data.range || 0,
      attackSpeed: data.attackSpeed || 0,
      projectileSpeed: data.projectileSpeed || 0,
      heal: data.heal || 0,
      damageBoost: data.damageBoost || 0,
      color: data.color, radius: data.radius,
      atkCd: 0
    };
    return { ok: true };
  },

  /** 获取某位置的设施 */
  getFacility(slotIndex) {
    return Game.buildings.facilities[slotIndex] || null;
  },

  /** 设施受伤（敌人攻击设施） */
  takeDamage(f, dmg) {
    f.hp -= dmg;
    if (f.hp <= 0) {
      Game.buildings.facilities[f.slot] = null;
      for (let i = 0; i < 10; i++) {
        Game.spawnParticle({
          x: f.x, y: f.y,
          vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
          life: 0.5, maxLife: 0.5, color: f.color, size: 3
        });
      }
    }
  },

  /** 获取英雄受到的伤害加成（booster 光环，实时计算） */
  getDamageBoost(hero) {
    let boost = 0;
    Game.buildings.facilities.forEach(f => {
      if (!f || f.type !== 'booster') return;
      if (distance(f, hero) <= f.range) boost = Math.max(boost, f.damageBoost);
    });
    return boost;
  },

  update(dt) {
    Game.buildings.facilities.forEach(f => {
      if (!f) return;
      f.atkCd = Math.max(0, f.atkCd - dt);
      switch (f.type) {
        case 'attacker': this._updateAttacker(f); break;
        case 'healer': this._updateHealer(f); break;
        // booster 光环在 getDamageBoost 实时计算，无需更新
      }
    });
  },

  /** 攻击型设施：找最近敌人射击 */
  _updateAttacker(f) {
    if (f.atkCd > 0) return;
    let nearest = null, minDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(f, en);
      if (d < f.range && d < minDist) { minDist = d; nearest = en; }
    });
    if (nearest) {
      const dx = nearest.x - f.x, dy = nearest.y - f.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      Game.systems.combat.spawnProjectile({
        x: f.x, y: f.y,
        vx: (dx / d) * f.projectileSpeed, vy: (dy / d) * f.projectileSpeed,
        damage: f.damage, color: f.color, radius: 5, life: 1.5
      });
      f.atkCd = 1 / f.attackSpeed;
    }
  },

  /** 治疗型设施：周期性治疗范围内受伤英雄 */
  _updateHealer(f) {
    if (f.atkCd > 0) return;
    let healed = false;
    Game.entities.heroes.forEach(h => {
      if (h.hp <= 0 || h.hp >= h.maxHp) return;
      if (distance(f, h) <= f.range) {
        h.hp = Math.min(h.maxHp, h.hp + f.heal);
        healed = true;
        Game.spawnParticle({
          x: h.x, y: h.y - 10, vx: 0, vy: -30,
          life: 0.5, maxLife: 0.5, color: '#06d6a0', size: 4
        });
      }
    });
    if (healed) f.atkCd = 1 / f.attackSpeed;
  }
};
