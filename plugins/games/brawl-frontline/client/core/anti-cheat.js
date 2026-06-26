/**
 * 反作弊遥测模块（brawl-frontline 专用）
 *
 * 客户端收集输入与游戏状态快照，提交排行榜时附带在 extra.antiCheat 中。
 * 服务端 anti-cheat.js 的 verifyBrawlAntiCheat 据此校验分数合理性。
 *
 * 三件套（与 8bit-arcade / buster 一致）：
 *   - createInputTracker()：创建输入追踪器
 *   - recordInput(tracker)：记录一次输入
 *   - getTelemetry(tracker)：返回 { inputCount, maxNoInputMs, playedMs }
 *
 * 状态快照 collectSnapshot()：从 Game.state/entities/buildings 读取关键字段
 *   - wave / kills / bossKills / heroCount / baseHp / gold / tickets / vaultLevel
 *
 * 模块对外只暴露 start/stop/tap/getReport 四个方法，内部单例 _tracker。
 */
import { Game } from './game.js';

let _tracker = null;
let _started = false;

function createInputTracker() {
  return { count: 0, lastTime: 0, maxGap: 0, startMs: 0, endMs: 0, active: false };
}

function startInputTracker(t) {
  t.count = 0; t.lastTime = 0; t.maxGap = 0;
  t.startMs = Date.now(); t.endMs = 0; t.active = true;
}

function recordInput(t) {
  if (!t || !t.active) return;
  const now = Date.now();
  if (t.lastTime > 0) {
    const gap = now - t.lastTime;
    if (gap > t.maxGap) t.maxGap = gap;
  }
  t.lastTime = now;
  t.count++;
}

function stopInputTracker(t) {
  if (!t || !t.active) return;
  t.active = false;
  t.endMs = Date.now();
  // 整局无任何输入：maxGap 记为总时长
  if (t.lastTime === 0) t.maxGap = t.endMs - t.startMs;
}

function getTelemetry(t) {
  if (!t) return { inputCount: 0, maxNoInputMs: 0, playedMs: 0 };
  const endMs = t.endMs || Date.now();
  return {
    inputCount: t.count,
    maxNoInputMs: t.maxGap,
    playedMs: Math.max(0, endMs - t.startMs)
  };
}

/**
 * 收集游戏状态快照（提交时锁定）
 * 服务端用于：分数上限推算、字段一致性校验
 */
function collectSnapshot() {
  const st = Game.state;
  if (!st) return null;
  const entities = Game.entities || {};
  const buildings = Game.buildings || {};
  const facilities = buildings.facilities || [];
  return {
    wave: st.wave || 0,
    kills: st.kills || 0,
    bossKills: st.bossKills || 0,
    heroCount: (entities.heroes || []).length,
    baseHp: Math.floor(Math.max(0, st.baseHp || 0)),
    gold: Math.floor(Math.max(0, st.gold || 0)),
    tickets: Math.floor(Math.max(0, st.tickets || 0)),
    vaultLevel: (buildings.vault && buildings.vault.level) || 1,
    facilityCount: facilities.filter(f => f).length
  };
}

export const AntiCheat = {
  /** 启动监测（玩家选完起始英雄进入第一波时调用） */
  start() {
    if (_started) return;
    _tracker = createInputTracker();
    startInputTracker(_tracker);
    _started = true;
  },

  /** 停止监测（游戏结束/功成身退时调用） */
  stop() {
    if (!_started) return;
    stopInputTracker(_tracker);
    _started = false;
  },

  /** 记录一次输入（点击/触屏/按键均调用） */
  tap() {
    recordInput(_tracker);
  },

  /** 是否已启动 */
  isRunning() {
    return _started;
  },

  /**
   * 获取完整反作弊数据（提交排行榜时调用）
   * 返回 null 表示未启动（向后兼容：无 antiCheat 字段时服务端放行）
   */
  getReport() {
    if (!_tracker) return null;
    const telemetry = getTelemetry(_tracker);
    const snapshot = collectSnapshot();
    if (!snapshot) return telemetry;
    return { ...telemetry, ...snapshot };
  }
};
