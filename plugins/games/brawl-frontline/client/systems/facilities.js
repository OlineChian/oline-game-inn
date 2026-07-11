/**
 * C 类炮塔系统：建造、回收、更新、攻击/治疗/光环
 * - attacker：自动攻击射程内敌人（速射炮塔/狙击炮塔）
 * - healer：周期性治疗范围内英雄（治疗炮塔）
 * - booster：光环效果，范围内英雄伤害提升（加伤炮塔）
 * - 炮塔有独立 hp，被敌人攻击至 0 后消失，可重建
 * - 再次点击已建造位可回收（半价退款），回收后全局价格 +20%、属性 +15%
 */
import { Game, LAYOUT } from '../core/game.js';
import { FACILITIES } from '../data/facilities.js';
import { uid, distance } from '../core/utils.js';
import { Buffs } from './buffs.js';
import * as SaveSystem from './save-system.js';

/** 回收价格倍率与属性倍率步进 */
const RECYCLE_COST_STEP = 0.2;
const RECYCLE_STAT_STEP = 0.15;

export const Facilities = {
  /** 在指定建造位建造炮塔（消耗金币，含回收等级 + buff 加成） */
  build(slotIndex, facilityId) {
    const data = FACILITIES[facilityId];
    if (!data) return { ok: false, msg: '无效炮塔' };
    if (slotIndex < 0 || slotIndex >= LAYOUT.facilitySlots.length) return { ok: false, msg: '无效建造位' };
    if (Game.buildings.facilities[slotIndex]) return { ok: false, msg: '该位置已有炮塔' };
    const tier = Game.buildings.facilityTier || 0;
    const cost = Math.floor(data.cost * (1 + tier * RECYCLE_COST_STEP));
    if (Game.state.gold < cost) return { ok: false, msg: '金币不足' };
    Game.state.gold -= cost;
    const slot = LAYOUT.facilitySlots[slotIndex];
    const statMult = 1 + tier * RECYCLE_STAT_STEP;
    const hpBuff = 1 + Buffs.facilityHpRate();
    const dmgBuff = 1 + Buffs.facilityDamageRate();
    const hp = Math.floor(Game.state.baseHp * (data.hpRate || 1) * statMult * hpBuff);
    Game.buildings.facilities[slotIndex] = {
      uid: uid('f'),
      id: data.id, name: data.name, type: data.type,
      slot: slotIndex, tier, builtCost: cost,
      x: slot.x, y: slot.y,
      hp, maxHp: hp,
      damage: Math.floor((data.damage || 0) * statMult * dmgBuff),
      range: data.range || 0,
      attackSpeed: data.attackSpeed || 0,
      projectileSpeed: data.projectileSpeed || 0,
      heal: Math.floor((data.heal || 0) * statMult * dmgBuff),
      damageBoost: (data.damageBoost || 0) * statMult * dmgBuff,
      color: data.color, radius: data.radius,
      atkCd: 0
    };
    SaveSystem.save();
    return { ok: true };
  },

  /** 回收炮塔：半价退款，全局回收等级 +1（后续建造价格/属性提升） */
  recycle(slotIndex) {
    const f = Game.buildings.facilities[slotIndex];
    if (!f) return { ok: false, msg: '该位置无炮塔' };
    const refund = Math.floor((f.builtCost || 0) * 0.5);
    Game.state.gold += refund;
    Game.buildings.facilities[slotIndex] = null;
    Game.buildings.facilityTier = (Game.buildings.facilityTier || 0) + 1;
    for (let i = 0; i < 10; i++) {
      Game.spawnParticle({ x: f.x, y: f.y, vx: (Math.random()-0.5)*120, vy: (Math.random()-0.5)*120, life: 0.5, maxLife: 0.5, color: f.color, size: 3 });
    }
    SaveSystem.save();
    return { ok: true, refund, tier: Game.buildings.facilityTier };
  },

  /** 获取炮塔建造预览（含回收等级 + buff 加成） */
  getPreview(facilityId) {
    const data = FACILITIES[facilityId];
    if (!data) return null;
    const tier = Game.buildings.facilityTier || 0;
    const cost = Math.floor(data.cost * (1 + tier * RECYCLE_COST_STEP));
    const statMult = 1 + tier * RECYCLE_STAT_STEP;
    const hpBuff = 1 + Buffs.facilityHpRate();
    const dmgBuff = 1 + Buffs.facilityDamageRate();
    return {
      name: data.name, desc: data.desc, color: data.color,
      cost, tier,
      hp: Math.floor(Game.state.baseHp * (data.hpRate || 1) * statMult * hpBuff),
      damage: Math.floor((data.damage || 0) * statMult * dmgBuff),
      heal: Math.floor((data.heal || 0) * statMult * dmgBuff),
      damageBoost: Math.round((data.damageBoost || 0) * statMult * dmgBuff * 100),
      range: data.range
    };
  },

  /** 获取某位置的炮塔 */
  getFacility(slotIndex) {
    return Game.buildings.facilities[slotIndex] || null;
  },

  /** 炮塔受伤（敌人攻击炮塔） */
  takeDamage(f, dmg) {
    f.hp -= dmg;
    if (f.hp <= 0) {
      Game.buildings.facilities[f.slot] = null;
      for (let i = 0; i < 10; i++) {
        Game.spawnParticle({ x: f.x, y: f.y, vx: (Math.random()-0.5)*120, vy: (Math.random()-0.5)*120, life: 0.5, maxLife: 0.5, color: f.color, size: 3 });
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
        case 'booster': this._updateBooster(f); break;
      }
    });
  },

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
      Game.systems.combat.spawnProjectile({ x: f.x, y: f.y, vx: (dx/d)*f.projectileSpeed, vy: (dy/d)*f.projectileSpeed, damage: f.damage, color: f.color, radius: 5, life: 1.5 });
      f.atkCd = 1 / f.attackSpeed;
    }
  },

  _updateHealer(f) {
    if (f.atkCd > 0) return;
    let healed = false;
    Game.entities.heroes.forEach(h => {
      if (h.hp <= 0 || h.hp >= h.maxHp) return;
      if (distance(f, h) <= f.range) { h.hp = Math.min(h.maxHp, h.hp + f.heal); healed = true; Game.spawnParticle({ x: h.x, y: h.y - 10, vx: 0, vy: -30, life: 0.5, maxLife: 0.5, color: '#06d6a0', size: 4 }); }
    });
    if (healed) f.atkCd = 1 / f.attackSpeed;
  },

  /** 加伤炮塔：周期性在范围内英雄上方生成红色粒子（光环效果在 getDamageBoost 实时计算） */
  _updateBooster(f) {
    if (f.atkCd > 0) return;
    Game.entities.heroes.forEach(h => {
      if (h.hp <= 0) return;
      if (distance(f, h) <= f.range) Game.spawnParticle({ x: h.x, y: h.y - 10, vx: 0, vy: -20, life: 0.6, maxLife: 0.6, color: '#f72585', size: 3 });
    });
    f.atkCd = 0.5;
  }
};
