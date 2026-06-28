/**
 * 分游戏反作弊阈值配置模块
 *
 * 职责：
 *   1. 定义各游戏可调数值项的默认值与元数据（label/desc）
 *   2. 从 storage 读取/保存管理员调整后的阈值
 *   3. 提供 getThresholds(gameId) 供 anti-cheat.js 查询
 *
 * 设计原则：
 *   - 未配置的游戏返回默认值
 *   - 仅暴露关键可调参数（容差/上限/阈值），游戏配置常量（如 BUSTER_CONFIGS）不在此调整
 *   - 所有数值带 label/desc 便于管理后台展示
 *
 * 存储结构：thresholds:{gameId} → { key: value, ... }
 */

// ==================== 默认阈值定义 ====================
//
// 每个游戏的可调参数。value 为默认值；管理员可通过管理后台覆盖。
// anti-cheat.js 在校验时通过 getThresholds(gameId) 读取，优先使用 storage 中的值。
const GAME_THRESHOLDS = {
  'brawl-frontline': {
    scoreCap:         { value: 999999, label: '分数上限',       desc: '分数超过此值判定为非法（受 scoreRange 规则开关控制）' },
    scoreFloor:       { value: 0,      label: '分数下限',       desc: '分数低于此值判定为非法（受 scoreRange 规则开关控制）' },
    scoreTolerance:    { value: 100,    label: '分数容差',      desc: '客户端计算与服务端重算的最大允许差异（gold 持续产出需留余量）' },
    baseMaxHp:        { value: 30000,  label: '基地血量上限',   desc: '基地最大生命值上限（客户端 BASE_MAX_HP=15000 + buff 加成）' },
    maxWave:          { value: 100,    label: '最大波数',       desc: '波数合理范围上限' },
    vaultMaxLevel:    { value: 10,     label: '金库等级上限',   desc: '金库等级最大值（客户端默认 5 级，可扩展至更高）' },
    maxGold:          { value: 100000, label: '金币上限',       desc: '金币数量上限' },
    maxTickets:       { value: 100000, label: '英雄券上限',     desc: '英雄券数量上限' },
    afkThresholdMs:   { value: 60000,  label: 'AFK阈值(ms)',   desc: '无操作超过此值判定为挂机' },
    msPerWave:        { value: 15000,  label: '每波最小时长(ms)', desc: '游戏时长与波数一致性校验：playedMs >= wave * 此值' },
    minInputs:        { value: 1,      label: '最少输入次数',    desc: '输入次数低于此值判定异常' }
  },
  'buster-montage': {
    scoreCap:         { value: 999999, label: '分数上限',       desc: '分数超过此值判定为非法（受 scoreRange 规则开关控制）' },
    scoreFloor:       { value: 0,      label: '分数下限',       desc: '分数低于此值判定为非法（受 scoreRange 规则开关控制）' },
    minPlayedMs:      { value: 3000,   label: '最短时长(ms)',  desc: '游戏时长低于此值判定异常' },
    afkThresholdMs:   { value: 15000,  label: 'AFK阈值(ms)',   desc: '无操作超过此值判定为挂机' },
    minInputs:        { value: 3,      label: '最少输入次数',    desc: '输入次数低于此值判定异常' }
  },
  'belle-challenge': {
    scoreCap:         { value: 3600,   label: '分数上限',       desc: '分数超过此值判定为非法（受 scoreRange 规则开关控制）' },
    scoreFloor:       { value: 1,      label: '分数下限',       desc: '分数低于此值判定为非法（受 scoreRange 规则开关控制）' },
    minPlayedMs:      { value: 500,    label: '最短时长(ms)',  desc: '游戏时长低于此值判定异常' },
    afkThresholdMs:   { value: 30000,  label: 'AFK阈值(ms)',   desc: '无操作超过此值判定为挂机' },
    minInputs:        { value: 3,      label: '最少输入次数',    desc: '输入次数低于此值判定异常' }
  },
  '8bit-arcade': {
    scoreCap:         { value: 999999, label: '分数上限',       desc: '分数超过此值判定为非法（受 scoreRange 规则开关控制）' },
    scoreFloor:       { value: 0,      label: '分数下限',       desc: '分数低于此值判定为非法（受 scoreRange 规则开关控制）' },
    msPerScore:       { value: 60,     label: '分秒比(ms/分)',  desc: '时长-分数一致性：playedMs >= score * 此值' },
    inputPerScore:    { value: 30,     label: '输入-分比(次/分)', desc: '输入频率：inputCount >= score / 此值' },
    afkThresholdMs:   { value: 10000,  label: 'AFK阈值(ms)',   desc: '无操作超过此值判定为挂机' }
  }
};

// ==================== 存储 key ====================

const KEY_PREFIX = 'thresholds:';

// ==================== 读取阈值 ====================

/**
 * 获取某游戏的阈值（合并默认值 + storage 覆盖）
 * @param {object} storage - leaderboard partitioned store
 * @param {string} gameId
 * @returns {object} { key: value } 扁平键值对（不含 label/desc）
 */
function getThresholds(storage, gameId) {
  const defaults = GAME_THRESHOLDS[gameId] || {};
  const saved = (storage && storage.get(KEY_PREFIX + gameId)) || {};
  const result = {};
  for (const key of Object.keys(defaults)) {
    const sv = saved[key];
    result[key] = (typeof sv === 'number' && Number.isFinite(sv)) ? sv : defaults[key].value;
  }
  return result;
}

/**
 * 获取某游戏阈值的完整定义（含 label/desc/value），供管理后台展示
 * @returns {object} { key: { value, label, desc } }
 */
function getThresholdDefs(storage, gameId) {
  const defaults = GAME_THRESHOLDS[gameId] || {};
  const saved = (storage && storage.get(KEY_PREFIX + gameId)) || {};
  const result = {};
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    const sv = saved[key];
    result[key] = {
      value: (typeof sv === 'number' && Number.isFinite(sv)) ? sv : def.value,
      label: def.label,
      desc: def.desc
    };
  }
  return result;
}

/**
 * 获取所有游戏的阈值定义（管理后台批量展示用）
 * @returns {object} { gameId: { key: { value, label, desc } } }
 */
function getAllThresholdDefs(storage) {
  const result = {};
  for (const gameId of Object.keys(GAME_THRESHOLDS)) {
    result[gameId] = getThresholdDefs(storage, gameId);
  }
  return result;
}

// ==================== 保存阈值 ====================

/**
 * 更新某游戏的阈值（部分更新，仅接受已知 key 且为有效数值）
 * @param {object} storage
 * @param {string} gameId
 * @param {object} updates - { key: value }
 * @returns {object} 更新后的完整阈值定义 { key: { value, label, desc } }
 */
function setThresholds(storage, gameId, updates) {
  const defaults = GAME_THRESHOLDS[gameId];
  if (!defaults) return null;  // 未知游戏拒绝
  const cur = (storage && storage.get(KEY_PREFIX + gameId)) || {};
  for (const key of Object.keys(defaults)) {
    const v = updates[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      cur[key] = v;
    }
  }
  if (storage) {
    storage.set(KEY_PREFIX + gameId, cur);
    console.warn('[thresholds] 游戏阈值已更新: ' + gameId + ' = ' + JSON.stringify(cur));
  }
  return getThresholdDefs(storage, gameId);
}

/** 游戏名称映射（管理后台展示用） */
const GAME_NAMES = {
  'brawl-frontline': '乱斗前线',
  'buster-montage': '巴斯特弹珠',
  'belle-challenge': '贝尔的挑战',
  '8bit-arcade': '8比特街机'
};

module.exports = {
  GAME_THRESHOLDS,
  GAME_NAMES,
  KEY_PREFIX,
  getThresholds,
  getThresholdDefs,
  getAllThresholdDefs,
  setThresholds
};
