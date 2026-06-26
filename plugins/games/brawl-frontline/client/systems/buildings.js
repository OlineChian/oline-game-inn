/**
 * 建筑系统：主题季宝库升级 + 召唤炮台维护 + 战场设施（Phase 2）
 * - upgradeVault(): 升级宝库等级（消耗金币）
 * - update(dt): 维护召唤炮台（攻击、持续时长、死亡移除）
 * - buildFacility(): Phase 2 实装 C 类设施
 */
import { Game } from '../core/game.js';
import { BUILDINGS, FACILITIES } from '../data/buildings.js';
import { distance } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';

export const Buildings = {
  /** 升级主题季宝库 */
  upgradeVault() {
    const vault = Game.buildings.vault;
    const data = BUILDINGS['vault'];
    if (vault.level >= data.maxLevel) return { ok: false, msg: '已满级' };
    const cost = data.upgradeCost[vault.level - 1];
    if (Game.state.gold < cost) return { ok: false, msg: '金币不足' };
    Game.state.gold -= cost;
    vault.level += 1;
    return { ok: true, level: vault.level };
  },

  /** 每帧更新：召唤炮台维护 */
  update(dt) {
    this._updateTurrets(dt);
    // Phase 2: this._updateFacilities(dt);
  },

  _updateTurrets(dt) {
    const turrets = Game.entities.turrets;
    for (let i = turrets.length - 1; i >= 0; i--) {
      const t = turrets[i];
      t.duration -= dt;
      t.atkCd = Math.max(0, t.atkCd - dt);
      if (t.atkCd <= 0) {
        const target = this._findEnemyForTurret(t);
        if (target) {
          const dir = Combat.dirTo(t, target, 400);
          Combat.spawnProjectile({
            x: t.x, y: t.y, vx: dir.vx, vy: dir.vy,
            damage: t.damage, color: t.color, radius: 4, life: 1.2
          });
          t.atkCd = 0.8;
        }
      }
      if (t.duration <= 0 || t.hp <= 0) {
        turrets.splice(i, 1);
      }
    }
  },

  _findEnemyForTurret(t) {
    let best = null;
    let bestDist = 200;
    Game.entities.enemies.forEach(en => {
      const d = distance(t, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  /** 建造 C 类设施（Phase 2 启用） */
  buildFacility(slotIndex, facilityId) {
    const data = FACILITIES[facilityId];
    if (!data || !data.enabled) return { ok: false, msg: '设施未开放' };
    if (slotIndex < 0 || slotIndex >= Game.buildings.facilities.length) {
      return { ok: false, msg: '无效建造位' };
    }
    if (Game.buildings.facilities[slotIndex]) {
      return { ok: false, msg: '该位置已有设施' };
    }
    if (Game.state.gold < data.cost) return { ok: false, msg: '金币不足' };
    Game.state.gold -= data.cost;
    Game.buildings.facilities[slotIndex] = {
      id: facilityId, name: data.name, color: data.color,
      cost: data.cost, duration: data.duration || 0,
      maxDuration: data.duration || 0
    };
    return { ok: true };
  },

  /** 获取宝库当前等级信息 */
  getVaultInfo() {
    const vault = Game.buildings.vault;
    const data = BUILDINGS['vault'];
    return {
      level: vault.level,
      maxLevel: data.maxLevel,
      goldPerSec: data.levels[vault.level - 1].goldPerSec,
      upgradeCost: vault.level < data.maxLevel ? data.upgradeCost[vault.level - 1] : null
    };
  }
};
