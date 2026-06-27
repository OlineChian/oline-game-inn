/**
 * 分级惩罚系统
 *
 * 职责：
 *   1. 违规计数（按 IP 永久累加，管理员可手动重置）
 *   2. 惩罚等级表（警告 → 10min → 30min → 2h → 8h → 24h 封顶）
 *   3. 惩罚历史记录（永久保存全部事件）
 *   4. 安全规则开关（5 个全局类别，默认全开）
 *   5. applyPenalty：组合上述，供 POST 路由在反作弊失败时调用
 *
 * 存储结构（均在 leaderboard partitioned store）：
 *   violation:ip:{ip} → { count, lastAt }
 *   penalty:log        → [{ at, ip, nickname, reason, level, action, gameId, durationMs }]
 *   security:rules     → { timeConsistency, scoreConsistency, afkDetection, inputFrequency, stateIntegrity }
 *
 * 依赖：security.js 的 flagCheater（写 ban 记录 + purge 标记）
 */

const { flagCheater } = require('./security');

// ==================== 惩罚等级表 ====================
// 违规次数 → 措施。第 6 次起封顶 24 小时。
const PENALTY_LEVELS = [
  { level: 1, action: 'warn', durationMs: 0 },                  // 警告：成绩不上传，不封禁
  { level: 2, action: 'ban',  durationMs: 10 * 60 * 1000 },     // 10 分钟
  { level: 3, action: 'ban',  durationMs: 30 * 60 * 1000 },     // 30 分钟
  { level: 4, action: 'ban',  durationMs: 2 * 60 * 60 * 1000 }, // 2 小时
  { level: 5, action: 'ban',  durationMs: 8 * 60 * 60 * 1000 }, // 8 小时
  { level: 6, action: 'ban',  durationMs: 24 * 60 * 60 * 1000 }  // 24 小时（封顶）
];

/** 根据违规次数返回惩罚措施（次数 ≥7 一律 24h） */
function getPenalty(count) {
  if (!count || count < 1) return null;
  const idx = Math.min(count, PENALTY_LEVELS.length) - 1;
  return PENALTY_LEVELS[idx];
}

// ==================== 违规计数 ====================

const VIOLATION_KEY_PREFIX = 'violation:ip:';

function getViolation(storage, ip) {
  if (!storage || !ip) return { count: 0, lastAt: 0 };
  return storage.get(VIOLATION_KEY_PREFIX + ip) || { count: 0, lastAt: 0 };
}

/** 违规计数 +1，返回新计数与对应惩罚等级 */
function incrementViolation(storage, ip) {
  if (!storage || !ip) return { count: 0, level: 1 };
  const cur = getViolation(storage, ip);
  const count = cur.count + 1;
  storage.set(VIOLATION_KEY_PREFIX + ip, { count, lastAt: Date.now() });
  return { count, level: count };
}

/** 管理员重置违规计数（解封后从警告重新开始，避免误封累积） */
function resetViolation(storage, ip) {
  if (!storage || !ip) return false;
  const existed = storage.has(VIOLATION_KEY_PREFIX + ip);
  storage.delete(VIOLATION_KEY_PREFIX + ip);
  if (existed) console.warn('[penalty] 违规计数已重置 IP=' + ip);
  return existed;
}

// ==================== 惩罚历史记录 ====================

const HISTORY_KEY = 'penalty:log';

function addHistory(storage, entry) {
  if (!storage) return;
  const log = storage.get(HISTORY_KEY) || [];
  log.push(Object.assign({ at: Date.now() }, entry));
  storage.set(HISTORY_KEY, log);
}

/** 列出全部惩罚历史（按时间倒序） */
function listHistory(storage) {
  if (!storage) return [];
  const log = storage.get(HISTORY_KEY) || [];
  return log.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}

// ==================== 安全规则开关 ====================
//
// 5 个全局类别，作用于所有游戏的反作弊校验：
//   timeConsistency  — 时长与分数/波数/timer 的一致性
//   scoreConsistency — 分数重算一致性（防孤立篡改 score 字段）
//   afkDetection     — 长时间无操作检测
//   inputFrequency   — 输入次数频率检测
//   stateIntegrity   — 游戏状态完整性（雷数/格数/砖块数/通关状态等）
//
// 默认全开；管理后台可单独关闭某类。关闭后该类规则在校验时跳过。

const RULES_KEY = 'security:rules';
const RULE_CATEGORIES = [
  { id: 'timeConsistency',  label: '时间一致性', desc: '游戏时长与分数/波数/计时是否匹配' },
  { id: 'scoreConsistency', label: '分数一致性', desc: '分数与游戏状态重算结果是否一致' },
  { id: 'afkDetection',     label: 'AFK检测',   desc: '长时间无操作检测（挂机/脚本）' },
  { id: 'inputFrequency',   label: '输入频率',   desc: '输入次数是否低于合理下限' },
  { id: 'stateIntegrity',   label: '状态完整性', desc: '雷数/格数/砖块数/通关状态等是否被篡改' }
];

/** 读取规则开关（未配置则全部默认开启） */
function getRules(storage) {
  if (!storage) {
    return RULE_CATEGORIES.reduce((m, c) => { m[c.id] = true; return m; }, {});
  }
  const saved = storage.get(RULES_KEY) || {};
  const result = {};
  for (const cat of RULE_CATEGORIES) {
    result[cat.id] = saved[cat.id] !== false; // 仅显式 false 才关闭
  }
  return result;
}

/** 更新规则开关（部分更新，仅接受已知类别） */
function setRules(storage, rules) {
  if (!storage || !rules) return getRules(storage);
  const cur = getRules(storage);
  for (const cat of RULE_CATEGORIES) {
    if (typeof rules[cat.id] === 'boolean') cur[cat.id] = rules[cat.id];
  }
  storage.set(RULES_KEY, cur);
  console.warn('[penalty] 安全规则已更新: ' + JSON.stringify(cur));
  return cur;
}

// ==================== 应用惩罚（核心入口）====================
//
// POST 路由在反作弊校验失败时调用，自动按违规次数分级处理：
//   - 警告（level 1）：成绩不上传，不封禁，返回 warned 让客户端弹警告
//   - 封禁（level ≥2）：写 ban 记录，返回 banned 让客户端弹封禁
// 同时写入惩罚历史。
//
// @returns {{ level, action, durationMs, count, warnUntil?: number }}
//   action='warn' 时无 ban 记录；action='ban' 时已写入 ban:ip:{ip}

function applyPenalty(storage, ip, reason, nickname, gameId) {
  const { count, level } = incrementViolation(storage, ip);
  const penalty = getPenalty(level);
  if (!penalty) return { level: 0, action: 'none', durationMs: 0, count };

  // 写入惩罚历史（永久保存）
  addHistory(storage, {
    ip: ip, nickname: nickname || '', reason: reason || '',
    level: level, action: penalty.action, gameId: gameId || '',
    durationMs: penalty.durationMs
  });

  if (penalty.action === 'ban') {
    // 写 ban 记录（flagCheater 内部处理 purge 标记，这里用 ban 不清成绩）
    flagCheater(storage, ip, reason, 'ban', nickname, penalty.durationMs);
    console.warn('[penalty] 触发封禁 IP=' + ip + ' nickname=' + (nickname || '-') +
      ' level=' + level + ' duration=' + (penalty.durationMs / 60000) + 'min reason=' + reason);
  } else {
    console.warn('[penalty] 触发警告 IP=' + ip + ' nickname=' + (nickname || '-') +
      ' level=' + level + ' reason=' + reason);
  }

  return {
    level: level,
    action: penalty.action,
    durationMs: penalty.durationMs,
    count: count
  };
}

module.exports = {
  PENALTY_LEVELS,
  RULE_CATEGORIES,
  VIOLATION_KEY_PREFIX,
  HISTORY_KEY,
  RULES_KEY,
  getPenalty,
  getViolation,
  incrementViolation,
  resetViolation,
  addHistory,
  listHistory,
  getRules,
  setRules,
  applyPenalty
};
