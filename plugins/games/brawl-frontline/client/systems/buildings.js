/**
 * 建筑系统：主题季宝库升级 + 战场设施（Phase 2）
 * - upgradeVault(): 升级宝库等级（消耗金币）
 * - update(dt): 占位（召唤炮台维护已迁移至 systems/hero-supers.js，避免双更新）
 * - buildFacility(): Phase 2 实装 C 类设施
 */
import { Game } from '../core/game.js';
import { BUILDINGS, FACILITIES } from '../data/buildings.js';
import * as SaveSystem from './save-system.js';

export const Buildings = {
  /** 升级主题季宝库（需波数到达 + 金币足够） */
  upgradeVault() {
    const vault = Game.buildings.vault;
    const data = BUILDINGS['vault'];
    if (vault.level >= data.maxLevel) return { ok: false, msg: '已满级' };
    const requiredWave = data.upgradeWaves[vault.level - 1];
    if (Game.state.wave < requiredWave) return { ok: false, msg: `第${requiredWave}波可升级` };
    const cost = data.upgradeCost[vault.level - 1];
    if (Game.state.gold < cost) return { ok: false, msg: '金币不足' };
    Game.state.gold -= cost;
    vault.level += 1;
    // 通知 UI：宝库升级（批量招募/自动合并解锁态可能变化）
    document.dispatchEvent(new CustomEvent('bf-vault-upgraded'));
    SaveSystem.save();
    return { ok: true, level: vault.level };
  },

  /** 每帧更新：占位（召唤炮台维护已迁移至 hero-supers.js） */
  update(dt) {
    // Phase 2: this._updateFacilities(dt);
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

  /** 获取宝库当前等级信息（含波数/金币进度） */
  getVaultInfo() {
    const vault = Game.buildings.vault;
    const data = BUILDINGS['vault'];
    const isMax = vault.level >= data.maxLevel;
    const requiredWave = isMax ? null : data.upgradeWaves[vault.level - 1];
    const cost = isMax ? null : data.upgradeCost[vault.level - 1];
    const waveReady = !isMax && Game.state.wave >= requiredWave;
    return {
      level: vault.level,
      maxLevel: data.maxLevel,
      goldPerSec: data.levels[vault.level - 1].goldPerSec,
      upgradeCost: cost,
      requiredWave,
      waveReady,
      isMax
    };
  }
};
