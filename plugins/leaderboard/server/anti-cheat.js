/**
 * 反作弊校验模块（游戏专用）
 *
 * 从 security.js 拆分而来，专注游戏状态快照校验。
 * security.js 保留 verifyAntiCheat 分发器，调用本模块的具体校验函数。
 *
 * 校验类型：
 *   - verifyDefaultAntiCheat：跑酷类（8bit-arcade），时长-分数一致性 + AFK
 *   - verifyBusterAntiCheat：弹珠球（buster-montage），状态快照 + 砖块/挡板/生命一致性
 *   - verifyBelleAntiCheat：扫雷（belle-challenge），雷数/格数/揭开数一致性 + 布局哈希
 *   - verifyBrawlAntiCheat：塔防（brawl-frontline），状态快照 + 分数重算一致性 + 时长/AFK
 *
 * 安全规则开关（rules 参数，5 个类别，默认全开）：
 *   timeConsistency  — 时长与分数/波数/timer 一致性
 *   scoreConsistency — 分数重算一致性
 *   afkDetection     — 长时间无操作检测
 *   inputFrequency   — 输入次数频率
 *   stateIntegrity   — 游戏状态完整性（雷数/格数/砖块数/通关状态等）
 *
 * 设计原则：
 *   1. 无 antiCheat 字段时跳过（向后兼容未接入游戏）
 *   2. 每个游戏独立阈值，得分节奏不同
 *   3. 基础字段校验（格式/非负）总是执行，不受开关影响；业务规则受开关控制
 */

/** 判断某类规则是否启用（未传 rules 或非显式 false 均视为开启） */
function on(rules, cat) { return !rules || rules[cat] !== false; }

// ==================== 默认校验（跑酷类 8bit-arcade）====================

function verifyDefaultAntiCheat(score, ac, rules) {
  const inputCount = Number(ac.inputCount);
  const maxNoInputMs = Number(ac.maxNoInputMs);
  const playedMs = Number(ac.playedMs);
  if (!Number.isFinite(inputCount) || !Number.isFinite(maxNoInputMs) || !Number.isFinite(playedMs)) {
    return { ok: false, error: 'antiCheat 字段格式错误', code: 400 };
  }
  if (inputCount < 0 || maxNoInputMs < 0 || playedMs < 0) {
    return { ok: false, error: 'antiCheat 字段非法', code: 400 };
  }
  if (on(rules, 'timeConsistency') && playedMs < score * 60) {
    return { ok: false, error: '游戏时长与分数不匹配', code: 400 };
  }
  if (on(rules, 'inputFrequency') && inputCount < Math.floor(score / 30)) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  if (on(rules, 'afkDetection') && maxNoInputMs >= 10000) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  return { ok: true };
}

// ==================== Buster 校验（弹珠球）====================

const BUSTER_CONFIGS = {
  easy:   { brickRows: 3, brickCols: 7, totalBricks: 21, paddleWidth: 120 },
  normal: { brickRows: 4, brickCols: 8, totalBricks: 32, paddleWidth: 100 },
  hard:   { brickRows: 5, brickCols: 9, totalBricks: 45, paddleWidth: 80 }
};
const BUSTER_BRICK_POINTS = [10, 20, 30, 40, 50, 100];
const BUSTER_MAX_LIVES = 5;
const BUSTER_WIDE_TOLERANCE = 2.5;

function computeBusterMaxScore(difficulty, won) {
  const config = BUSTER_CONFIGS[difficulty];
  if (!config) return -1;
  const { brickRows, brickCols } = config;
  let maxBrickScore = 0;
  for (let row = 0; row < brickRows; row++) {
    const points = BUSTER_BRICK_POINTS[Math.min(row, BUSTER_BRICK_POINTS.length - 1)];
    maxBrickScore += brickCols * points;
  }
  const maxBonus = won ? BUSTER_MAX_LIVES * 100 : 0;
  return maxBrickScore + maxBonus;
}

function verifyBusterAntiCheat(score, ac, extra, rules) {
  const difficulty = extra && extra.difficulty;
  if (!difficulty || !BUSTER_CONFIGS[difficulty]) {
    return { ok: false, error: '难度非法或缺失', code: 400 };
  }
  const config = BUSTER_CONFIGS[difficulty];
  if (typeof ac.won !== 'boolean') {
    return { ok: false, error: 'antiCheat.won 字段格式错误', code: 400 };
  }
  const won = ac.won;
  const numFields = ['bricksDestroyed', 'totalBricks', 'finalLives', 'maxPaddleWidth', 'playedMs', 'inputCount', 'maxNoInputMs'];
  const v = {};
  for (const f of numFields) {
    v[f] = Number(ac[f]);
    if (!Number.isFinite(v[f])) return { ok: false, error: 'antiCheat.' + f + ' 字段格式错误', code: 400 };
    if (v[f] < 0) return { ok: false, error: 'antiCheat.' + f + ' 字段非法（负数）', code: 400 };
  }
  if (on(rules, 'stateIntegrity')) {
    if (v.totalBricks !== config.totalBricks) {
      return { ok: false, error: '砖块总数与难度配置不符', code: 400 };
    }
    if (v.bricksDestroyed > v.totalBricks) {
      return { ok: false, error: '击碎砖块数超过总数', code: 400 };
    }
    if (won && v.bricksDestroyed !== v.totalBricks) {
      return { ok: false, error: '通关状态与击碎砖块数不一致', code: 400 };
    }
    if (!won && v.bricksDestroyed === v.totalBricks) {
      return { ok: false, error: '击碎所有砖块但未通关（状态异常）', code: 400 };
    }
    if (won && v.finalLives < 1) {
      return { ok: false, error: '通关时生命数异常', code: 400 };
    }
    if (v.finalLives > BUSTER_MAX_LIVES) {
      return { ok: false, error: '生命数超过上限', code: 400 };
    }
    if (v.maxPaddleWidth > config.paddleWidth * BUSTER_WIDE_TOLERANCE) {
      return { ok: false, error: '挡板宽度异常', code: 400 };
    }
  }
  if (on(rules, 'scoreConsistency')) {
    const maxScore = computeBusterMaxScore(difficulty, won);
    if (score > maxScore) {
      return { ok: false, error: '分数超过理论上限', code: 400 };
    }
  }
  if (on(rules, 'timeConsistency') && v.playedMs < 3000) {
    return { ok: false, error: '游戏时长过短', code: 400 };
  }
  if (on(rules, 'afkDetection') && v.maxNoInputMs >= 15000) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  if (on(rules, 'inputFrequency') && v.inputCount < 3) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  return { ok: true };
}

// ==================== Belle 校验（扫雷）====================

const BELLE_CONFIGS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  normal: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 }
};
const BELLE_AFK_THRESHOLD_MS = 30000;
const BELLE_MIN_PLAYED_MS = 500;
const BELLE_MIN_INPUTS = 3;
const BELLE_HASH_REGEX = /^[a-f0-9]{64}$/;

function verifyBelleAntiCheat(score, ac, extra, rules) {
  const difficulty = extra && extra.difficulty;
  if (!difficulty || !BELLE_CONFIGS[difficulty]) {
    return { ok: false, error: '难度非法或缺失', code: 400 };
  }
  const config = BELLE_CONFIGS[difficulty];
  if (typeof ac.won !== 'boolean') {
    return { ok: false, error: 'antiCheat.won 字段格式错误', code: 400 };
  }
  const won = ac.won;
  const numFields = ['mineCount', 'totalCells', 'revealedCount', 'flagCount', 'playedMs', 'inputCount', 'maxNoInputMs'];
  const v = {};
  for (const f of numFields) {
    v[f] = Number(ac[f]);
    if (!Number.isFinite(v[f])) return { ok: false, error: 'antiCheat.' + f + ' 字段格式错误', code: 400 };
    if (v[f] < 0) return { ok: false, error: 'antiCheat.' + f + ' 字段非法（负数）', code: 400 };
  }
  if (on(rules, 'stateIntegrity')) {
    if (v.mineCount !== config.mines) {
      return { ok: false, error: '雷数与难度配置不符', code: 400 };
    }
    const expectedCells = config.rows * config.cols;
    if (v.totalCells !== expectedCells) {
      return { ok: false, error: '总格数与难度配置不符', code: 400 };
    }
    const expectedRevealed = expectedCells - config.mines;
    if (v.revealedCount > expectedRevealed) {
      return { ok: false, error: '揭开数超过非雷格总数', code: 400 };
    }
    if (won && v.revealedCount !== expectedRevealed) {
      return { ok: false, error: '通关状态与揭开数不一致', code: 400 };
    }
    if (!won && v.revealedCount === expectedRevealed) {
      return { ok: false, error: '揭开所有非雷格但未通关（状态异常）', code: 400 };
    }
    if (v.flagCount > config.mines * 2) {
      return { ok: false, error: '标记数异常', code: 400 };
    }
    const hash = ac.minePositionsHash;
    if (typeof hash !== 'string' || !BELLE_HASH_REGEX.test(hash)) {
      return { ok: false, error: '地雷布局哈希格式错误', code: 400 };
    }
  }
  if (on(rules, 'timeConsistency')) {
    if (v.playedMs < BELLE_MIN_PLAYED_MS) {
      return { ok: false, error: '游戏时长过短', code: 400 };
    }
    const expectedPlayedMs = score * 1000;
    if (v.playedMs < expectedPlayedMs - 1000 || v.playedMs > expectedPlayedMs + 2000) {
      return { ok: false, error: '游戏时长与用时记录不符', code: 400 };
    }
  }
  if (on(rules, 'afkDetection') && v.maxNoInputMs >= BELLE_AFK_THRESHOLD_MS) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  if (on(rules, 'inputFrequency') && v.inputCount < BELLE_MIN_INPUTS) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  return { ok: true };
}

// ==================== Brawl Frontline 校验（塔防）====================

const BRAWL_BASE_MAX_HP = 1500;
const BRAWL_MAX_WAVE = 100;
const BRAWL_MAX_GOLD = 100000;
const BRAWL_MAX_TICKETS = 100000;
const BRAWL_AFK_THRESHOLD_MS = 60000;
const BRAWL_MS_PER_WAVE = 15000;
const BRAWL_SCORE_TOLERANCE = 5;
const BRAWL_MIN_INPUTS = 1;

function computeBrawlScore(s) {
  return Math.floor(
    s.wave * 100 + s.kills * 2 + s.bossKills * 300 +
    Math.max(0, s.baseHp) + s.gold / 20
  );
}

function verifyBrawlAntiCheat(score, ac, rules) {
  if (!ac || typeof ac !== 'object') {
    return { ok: false, error: 'antiCheat 字段缺失', code: 400 };
  }
  const numFields = ['wave', 'kills', 'bossKills', 'heroCount', 'baseHp',
    'gold', 'tickets', 'vaultLevel', 'playedMs', 'inputCount', 'maxNoInputMs'];
  const v = {};
  for (const f of numFields) {
    v[f] = Number(ac[f]);
    if (!Number.isFinite(v[f])) {
      return { ok: false, error: 'antiCheat.' + f + ' 字段格式错误', code: 400 };
    }
    if (v[f] < 0) {
      return { ok: false, error: 'antiCheat.' + f + ' 字段非法（负数）', code: 400 };
    }
  }
  if (on(rules, 'stateIntegrity')) {
    if (v.wave < 1 || v.wave > BRAWL_MAX_WAVE) {
      return { ok: false, error: '波数超出合理范围', code: 400 };
    }
    if (v.vaultLevel < 1 || v.vaultLevel > 5) {
      return { ok: false, error: '金库等级非法', code: 400 };
    }
    if (v.baseHp > BRAWL_BASE_MAX_HP) {
      return { ok: false, error: '基地血量超过上限', code: 400 };
    }
    // 英雄数量无上限：受 tickets 上限（BRAWL_MAX_TICKETS）间接约束
    // 原上限 50 在第 20 波后正常玩家即被误封
    if (v.gold > BRAWL_MAX_GOLD) {
      return { ok: false, error: '金币数量异常', code: 400 };
    }
    if (v.tickets > BRAWL_MAX_TICKETS) {
      return { ok: false, error: '英雄券数量异常', code: 400 };
    }
    const maxBoss = Math.floor(v.wave / 5) + 1;
    if (v.bossKills > maxBoss) {
      return { ok: false, error: 'Boss 击杀数异常', code: 400 };
    }
  }
  if (on(rules, 'scoreConsistency')) {
    const expected = computeBrawlScore(v);
    if (Math.abs(score - expected) > BRAWL_SCORE_TOLERANCE) {
      return { ok: false, error: '分数与游戏状态不一致', code: 400 };
    }
  }
  if (on(rules, 'timeConsistency') && v.playedMs < v.wave * BRAWL_MS_PER_WAVE) {
    return { ok: false, error: '游戏时长与波数不匹配', code: 400 };
  }
  if (on(rules, 'afkDetection') && v.maxNoInputMs >= BRAWL_AFK_THRESHOLD_MS) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  if (on(rules, 'inputFrequency') && v.inputCount < BRAWL_MIN_INPUTS) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  return { ok: true };
}

// ==================== 统一分发器 ====================

function verifyGameAntiCheat(gameId, score, ac, extra, rules) {
  if (gameId === 'buster-montage') {
    return verifyBusterAntiCheat(score, ac, extra, rules);
  }
  if (gameId === 'belle-challenge') {
    return verifyBelleAntiCheat(score, ac, extra, rules);
  }
  if (gameId === 'brawl-frontline') {
    return verifyBrawlAntiCheat(score, ac, rules);
  }
  return verifyDefaultAntiCheat(score, ac, rules);
}

module.exports = {
  verifyGameAntiCheat,
  verifyDefaultAntiCheat,
  verifyBusterAntiCheat,
  verifyBelleAntiCheat,
  verifyBrawlAntiCheat,
  computeBusterMaxScore,
  computeBrawlScore,
  BUSTER_CONFIGS,
  BELLE_CONFIGS
};
