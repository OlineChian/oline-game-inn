/**
 * 乱斗前线 - 临时存档系统（localStorage，24h 过期）
 *
 * 完整保存游戏状态：英雄/敌人/炮台/召唤物/燃烧区/强化/建筑/波次进度/经济/解锁/设置。
 * 读取时若已过期自动清除并返回 null。仅在 wave 阶段保存有意义的中途进度。
 *
 * 存档结构：
 *   { saveVersion, savedAt, expiresAt,
 *     state: { gameState, heroes, enemies, turrets, summons, fireZones, buffs, buildings, wave, settings } }
 *
 * 参考切斯特牌 save-system.js，按乱斗前线状态结构扩展。
 */
import { Game } from '../core/game.js';
import { Wave } from './wave.js';
import { Audio } from '../core/audio.js';

const STORAGE_KEY = 'brawl-frontline:save';
const TTL_MS = 24 * 60 * 60 * 1000;  // 24 小时
const SAVE_VERSION = 1;

/** 从运行时状态提取可序列化快照 */
function serialize() {
  const st = Game.state;
  return {
    saveVersion: SAVE_VERSION,
    savedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
    state: {
      gameState: { ...st },
      // 英雄：浅拷贝并重置跨帧锁定计时（恢复后不再锁定已消失的目标）
      heroes: Game.entities.heroes.map(h => ({ ...h, _targetTimer: 0, _targetUid: null })),
      enemies: Game.entities.enemies.map(e => ({ ...e })),
      turrets: Game.entities.turrets.map(t => ({ ...t })),
      summons: Game.entities.summons.map(s => ({ ...s })),
      fireZones: Game.entities.fireZones.map(f => ({ ...f })),
      buffs: Game.buffs.map(b => ({ ...b })),
      // buildings 含 facilities 数组（含 null 元素），深拷贝避免引用共享
      buildings: JSON.parse(JSON.stringify(Game.buildings)),
      wave: { current: Wave.current, queue: Wave.queue, timer: Wave.timer, spawning: Wave.spawning },
      settings: {
        speedMultiplier: st.speedMultiplier || 1,
        audioEnabled: !!Audio.enabled,
        audioVolume: Audio.volume
      }
    }
  };
}

/** 保存（仅在 wave 阶段保存有意义的中途进度） */
export function save() {
  if (!Game.state || Game.state.phase !== 'wave') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
  } catch (e) {
    // localStorage 不可用（隐私模式/配额满）— 静默失败
  }
}

/** 读取存档（过期自动清除并返回 null） */
export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.expiresAt || !payload.state) { clearSave(); return null; }
    if (Date.now() > payload.expiresAt) { clearSave(); return null; }
    return payload;
  } catch (e) {
    clearSave();
    return null;
  }
}

/** 是否存在有效存档（未过期） */
export function hasSave() {
  return loadGame() !== null;
}

/** 清除存档 */
export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // 静默失败
  }
}

/** 获取存档剩余有效时间（毫秒） */
export function getSaveRemainingTime() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const payload = JSON.parse(raw);
    if (!payload || !payload.expiresAt) return 0;
    return Math.max(0, payload.expiresAt - Date.now());
  } catch (e) {
    return 0;
  }
}

/**
 * 将存档应用到运行时（恢复后 phase=wave, paused=false, buffPending=false）
 * 调用前 Game.init() 已完成；本函数覆写状态/实体/建筑/强化/波次/设置。
 * @param {Object} payload loadGame() 返回的存档
 */
export function applySnapshot(payload) {
  if (!payload || !payload.state) return false;
  const s = payload.state;
  const st = Game.state;

  Object.assign(st, s.gameState);
  st.phase = 'wave';
  st.paused = false;
  st.buffPending = false;

  Game.entities.heroes = (s.heroes || []).map(h => ({
    ...h, _targetTimer: 0, _targetUid: null, superFlash: 0
  }));
  Game.entities.enemies = (s.enemies || []).map(e => ({ ...e }));
  Game.entities.turrets = (s.turrets || []).map(t => ({ ...t }));
  Game.entities.summons = (s.summons || []).map(sm => ({ ...sm }));
  Game.entities.fireZones = (s.fireZones || []).map(f => ({ ...f }));
  Game.entities.projectiles = [];
  Game.entities.particles = [];

  Game.buffs = (s.buffs || []).map(b => ({ ...b }));
  Game.buildings = s.buildings || Game.buildings;

  Wave.current = s.wave.current;
  Wave.queue = s.wave.queue || [];
  Wave.timer = s.wave.timer || 0;
  Wave.spawning = !!s.wave.spawning;

  st.speedMultiplier = (s.settings && s.settings.speedMultiplier) || 1;
  if (s.settings) {
    Audio.enabled = !!s.settings.audioEnabled;
    Audio.volume = (typeof s.settings.audioVolume === 'number') ? s.settings.audioVolume : 0.5;
  }
  return true;
}
