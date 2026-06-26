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
 *
 * 设计原则：
 *   1. 无 antiCheat 字段时跳过（向后兼容未接入游戏）
 *   2. 每个游戏独立阈值，得分节奏不同
 *   3. 服务端只做"可验证"的校验，不依赖客户端不可信数据
 */

// ==================== 默认校验（跑酷类 8bit-arcade）====================

/**
 * 跑酷类反作弊校验
 *
 * 客户端在 extra.antiCheat 中附带：
 *   - inputCount：游戏中总输入次数（按键/触屏均计 1 次）
 *   - maxNoInputMs：最长无操作间隔（毫秒）
 *   - playedMs：游戏时长（毫秒）
 *
 * 校验规则：
 *   1. 时长-分数一致性：playedMs >= score * 60（60fps 下 6 分/秒，阈值允许 ~16 分/秒）
 *   2. 输入频率：inputCount >= floor(score / 30)
 *   3. AFK 检测：maxNoInputMs < 10000
 */
function verifyDefaultAntiCheat(score, ac) {
  const inputCount = Number(ac.inputCount);
  const maxNoInputMs = Number(ac.maxNoInputMs);
  const playedMs = Number(ac.playedMs);
  if (!Number.isFinite(inputCount) || !Number.isFinite(maxNoInputMs) || !Number.isFinite(playedMs)) {
    return { ok: false, error: 'antiCheat 字段格式错误', code: 400 };
  }
  if (inputCount < 0 || maxNoInputMs < 0 || playedMs < 0) {
    return { ok: false, error: 'antiCheat 字段非法', code: 400 };
  }
  if (playedMs < score * 60) {
    return { ok: false, error: '游戏时长与分数不匹配', code: 400 };
  }
  if (inputCount < Math.floor(score / 30)) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  if (maxNoInputMs >= 10000) {
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

/**
 * buster-montage 专用校验
 * 校验：难度/总砖块数/击碎数/通关一致性/生命数/挡板宽度/分数上限/时长/AFK/输入
 */
function verifyBusterAntiCheat(score, ac, extra) {
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
  const maxScore = computeBusterMaxScore(difficulty, won);
  if (score > maxScore) {
    return { ok: false, error: '分数超过理论上限', code: 400 };
  }
  if (v.playedMs < 3000) {
    return { ok: false, error: '游戏时长过短', code: 400 };
  }
  if (v.maxNoInputMs >= 15000) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  if (v.inputCount < 3) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  return { ok: true };
}

// ==================== Belle 校验（扫雷）====================

/**
 * Belle 难度配置（与服务端 site.json scoreFloor/scoreCap 配合）
 * 注意：rows/cols/mines 必须与 belle/client/script.js 的 difficulties 完全一致
 */
const BELLE_CONFIGS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  normal: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 }
};
const BELLE_AFK_THRESHOLD_MS = 30000; // 扫雷节奏慢，30 秒 AFK 阈值
const BELLE_MIN_PLAYED_MS = 500;      // 最短 0.5 秒（防秒通关脚本）
const BELLE_MIN_INPUTS = 3;           // 至少 3 次点击
const BELLE_HASH_REGEX = /^[a-f0-9]{64}$/; // SHA-256 hex

/**
 * belle-challenge 专用校验（扫雷）
 *
 * 得分语义：score = timer（秒），升序排序，越短越好
 * 攻击面：篡改地雷位置/雷数/揭开数/胜利状态
 *
 * 客户端在 extra.antiCheat 中附带：
 *   - mineCount：雷数
 *   - totalCells：总格数（rows*cols）
 *   - revealedCount：已揭开非雷格数
 *   - flagCount：标记数
 *   - won：是否通关（布尔）
 *   - playedMs：游戏时长（毫秒）
 *   - inputCount：输入次数（点击数）
 *   - maxNoInputMs：最长无操作间隔
 *   - minePositionsHash：地雷布局哈希（首点生成后锁定，提交前重新计算比对）
 *
 * 校验规则：
 *   1. 难度合法性
 *   2. 雷数一致性：mineCount 匹配服务端配置
 *   3. 总格数一致性：totalCells 匹配 rows*cols
 *   4. 揭开数上限：revealedCount <= totalCells - mineCount（先排除不可能状态）
 *   5. 胜利条件：won ⟺ revealedCount === totalCells - mineCount
 *   6. 标记数上限：flagCount <= mineCount * 2
 *   7. 布局哈希格式：minePositionsHash 必须是 64 位 hex
 *   8. 时长下限：playedMs >= 500
 *   9. AFK 检测：maxNoInputMs < 30000
 *   10. 输入下限：inputCount >= 3
 *   11. 用时合理性：score*1000-1000 <= playedMs <= score*1000+2000（timer 误差容忍）
 */
function verifyBelleAntiCheat(score, ac, extra) {
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

  // 1. 雷数一致性
  if (v.mineCount !== config.mines) {
    return { ok: false, error: '雷数与难度配置不符', code: 400 };
  }
  // 2. 总格数一致性
  const expectedCells = config.rows * config.cols;
  if (v.totalCells !== expectedCells) {
    return { ok: false, error: '总格数与难度配置不符', code: 400 };
  }
  // 3. 揭开数上限（先于胜利条件：揭示不可能状态 > 揭示数 > 非雷格总数）
  const expectedRevealed = expectedCells - config.mines;
  if (v.revealedCount > expectedRevealed) {
    return { ok: false, error: '揭开数超过非雷格总数', code: 400 };
  }
  // 4. 胜利条件：揭开数 = 总格数 - 雷数
  if (won && v.revealedCount !== expectedRevealed) {
    return { ok: false, error: '通关状态与揭开数不一致', code: 400 };
  }
  if (!won && v.revealedCount === expectedRevealed) {
    return { ok: false, error: '揭开所有非雷格但未通关（状态异常）', code: 400 };
  }
  // 5. 标记数上限（允许误标，但不超过雷数 2 倍）
  if (v.flagCount > config.mines * 2) {
    return { ok: false, error: '标记数异常', code: 400 };
  }
  // 6. 布局哈希格式校验（防篡改地雷位置）
  const hash = ac.minePositionsHash;
  if (typeof hash !== 'string' || !BELLE_HASH_REGEX.test(hash)) {
    return { ok: false, error: '地雷布局哈希格式错误', code: 400 };
  }
  // 7. 时长下限
  if (v.playedMs < BELLE_MIN_PLAYED_MS) {
    return { ok: false, error: '游戏时长过短', code: 400 };
  }
  // 8. AFK 检测
  if (v.maxNoInputMs >= BELLE_AFK_THRESHOLD_MS) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  // 9. 输入下限
  if (v.inputCount < BELLE_MIN_INPUTS) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  // 10. 用时合理性：score 是秒数，playedMs 是毫秒，允许 1 秒误差
  const expectedPlayedMs = score * 1000;
  if (v.playedMs < expectedPlayedMs - 1000 || v.playedMs > expectedPlayedMs + 2000) {
    return { ok: false, error: '游戏时长与用时记录不符', code: 400 };
  }
  return { ok: true };
}

// ==================== 统一分发器 ====================

/**
 * 游戏专用反作弊校验分发器
 * @param {string} gameId
 * @param {number} score - 已 Number 化的分数
 * @param {object} ac - extra.antiCheat
 * @param {object} extra - extra 对象（含 difficulty 等）
 * @returns {{ok:true}|{ok:false,error:string,code:number}}
 */
function verifyGameAntiCheat(gameId, score, ac, extra) {
  if (gameId === 'buster-montage') {
    return verifyBusterAntiCheat(score, ac, extra);
  }
  if (gameId === 'belle-challenge') {
    return verifyBelleAntiCheat(score, ac, extra);
  }
  return verifyDefaultAntiCheat(score, ac);
}

module.exports = {
  verifyGameAntiCheat,
  verifyDefaultAntiCheat,
  verifyBusterAntiCheat,
  verifyBelleAntiCheat,
  computeBusterMaxScore,
  BUSTER_CONFIGS,
  BELLE_CONFIGS
};
