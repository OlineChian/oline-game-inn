/**
 * 排行榜成绩提交安全验证模块
 *
 * 防御目标（针对"抓 POST 包篡改成绩"）：
 *   L1. HMAC-SHA256 签名校验 —— 防止抓包后直接修改 score 值
 *   L2. timestamp 时间窗口 + nonce 一次性 —— 防止抓到完整包后重放
 *
 * 密钥策略：
 *   - 服务端读 SCORE_SIGN_SECRET 环境变量；未设置时使用默认值（仅开发环境）。
 *   - 客户端硬编码同一密钥（见 public/score-signer.js），会被反编译，
 *     属已知局限，作为第一道防线而非绝对防护。
 *   - 实际 HMAC key = SECRET + ':' + gameId，按游戏派生，
 *     单游戏密钥泄露不影响其他游戏。
 *
 * 签名内容：gameId|nickname|score|timestamp|nonce
 *
 * 注意：纯前端游戏的分数本质上无法在服务端验证真实性，
 * 本模块只提高攻击成本（挡住抓包改值/重放），无法防"脱离客户端直接构造合法签名"。
 * 后续可叠加服务端游戏会话（L5）进一步加固。
 */

const crypto = require('crypto');

// 开发环境 fallback 密钥；生产必须通过环境变量 SCORE_SIGN_SECRET 覆盖。
// 与 public/score-signer.js 中的默认值保持一致，确保本地开发开箱即用。
const DEFAULT_SECRET = 'oline-score-sign-dev-default';

// 请求时间窗口：5 分钟内有效，超过则视为过期/重放
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
// nonce 缓存有效期：与时间窗口一致
const NONCE_TTL_MS = 5 * 60 * 1000;
// nonce 定期清理间隔
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000;
// nonce 缓存数量上限，超过触发强制清理，防止内存无限增长
const NONCE_MAX_SIZE = 10000;

let secretWarned = false;

function getSecret() {
  const secret = process.env.SCORE_SIGN_SECRET;
  if (!secret) {
    if (!secretWarned) {
      secretWarned = true;
      // 仅警告一次，避免日志刷屏
      console.warn('[security] SCORE_SIGN_SECRET 未设置，使用默认开发密钥。生产环境必须设置该环境变量！');
    }
    return DEFAULT_SECRET;
  }
  return secret;
}

function deriveKey(secret, gameId) {
  return secret + ':' + gameId;
}

/**
 * 计算签名（服务端与客户端需保持算法一致）
 */
function computeSignature(secret, gameId, payload) {
  const key = deriveKey(secret, gameId);
  const message = [
    payload.gameId,
    payload.nickname,
    String(payload.score),
    String(payload.timestamp),
    payload.nonce
  ].join('|');
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

/**
 * 常量时间比较两个 hex 字符串，避免时序攻击
 */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// nonce 缓存：nonce 字符串 -> 过期时间戳
const nonceStore = new Map();
let cleanupTimer = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredNonces, NONCE_CLEANUP_INTERVAL_MS);
  // 不阻止进程退出（unref 仅在 timer 暴露该方法时调用）
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }
}

function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [n, expireAt] of nonceStore) {
    if (expireAt <= now) {
      nonceStore.delete(n);
    }
  }
}

/**
 * 检查并消费 nonce。若 nonce 在有效期内已存在，返回 true（已用，拒绝请求）；
 * 否则记录该 nonce 并返回 false（首次使用，允许）。
 */
function isNonceUsed(nonce) {
  const now = Date.now();
  const expireAt = nonceStore.get(nonce);
  if (expireAt && expireAt > now) {
    return true; // 仍在有效期内，重复提交
  }
  nonceStore.set(nonce, now + NONCE_TTL_MS);
  ensureCleanupTimer();
  if (nonceStore.size > NONCE_MAX_SIZE) {
    cleanupExpiredNonces();
  }
  return false;
}

/**
 * 验证提交请求的签名、时间戳、nonce
 * @param {string} gameId
 * @param {object} body - req.body，需含 nickname/score/timestamp/nonce/signature
 * @returns {{ok:true}|{ok:false,error:string,code:number}}
 */
function verifySubmission(gameId, body) {
  const { nickname, score, timestamp, nonce, signature } = body || {};

  if (!nickname || score === undefined || score === null ||
      !timestamp || !nonce || !signature) {
    return { ok: false, error: '缺少签名参数（timestamp/nonce/signature）', code: 400 };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: 'timestamp 格式错误', code: 400 };
  }

  // 时间窗口校验：超过 5 分钟视为过期
  const now = Date.now();
  if (Math.abs(now - ts) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, error: '请求已过期', code: 400 };
  }

  // 签名校验（先验签，再消费 nonce，避免错误签名污染 nonce 缓存）
  const expected = computeSignature(getSecret(), gameId, {
    gameId, nickname, score, timestamp, nonce
  });
  if (!safeEqualHex(expected, String(signature))) {
    return { ok: false, error: '签名校验失败', code: 400 };
  }

  // nonce 防重放：签名通过后才消费 nonce，拦截重放请求
  if (isNonceUsed(String(nonce))) {
    return { ok: false, error: '请求已提交（请勿重复提交）', code: 400 };
  }

  return { ok: true };
}

/**
 * 反作弊遥测校验分发器（防 AFK / 障碍物删除刷分 / 状态篡改）
 *
 * 无 extra.antiCheat 字段时跳过校验（向后兼容未接入的游戏）。
 * 有 antiCheat 时按 gameId 分发到专用校验（不同游戏得分节奏不同，阈值独立）：
 *   - buster-montage → verifyBusterAntiCheat（状态快照 + AFK）
 *   - 其他（8bit-arcade 等）→ verifyDefaultAntiCheat（时长-分数一致性 + AFK）
 *
 * @param {string} gameId
 * @param {object} body - req.body，需含 score + extra.antiCheat
 * @returns {{ok:true}|{ok:false,error:string,code:number}}
 */
function verifyAntiCheat(gameId, body) {
  const extra = body && body.extra;
  const ac = extra && extra.antiCheat;
  if (!ac) return { ok: true }; // 无遥测数据，跳过校验（向后兼容）

  const score = Number(body.score);
  if (!Number.isFinite(score)) {
    return { ok: false, error: 'score 格式错误', code: 400 };
  }

  // 按游戏分发到专用校验
  if (gameId === 'buster-montage') {
    return verifyBusterAntiCheat(score, ac, extra);
  }
  return verifyDefaultAntiCheat(score, ac);
}

/**
 * 跑酷类反作弊校验（8bit-arcade 等）
 *
 * 客户端在 extra.antiCheat 中附带：
 *   - inputCount：游戏中总输入次数（按键/触屏均计 1 次）
 *   - maxNoInputMs：最长无操作间隔（毫秒）
 *   - playedMs：游戏时长（毫秒）
 *
 * 校验规则：
 *   1. 时长-分数一致性：playedMs >= score * 60
 *      score = frameCount/10，60fps 下 6 分/秒，阈值允许最高 ~16 分/秒（兼容 120/144Hz）
 *   2. 输入频率：inputCount >= floor(score / 30)
 *      正常约每 3-5 秒需输入一次（避障），阈值放宽到每 5 秒 1 次
 *   3. AFK 检测：maxNoInputMs < 10000
 *      超过 10 秒无操作视为挂机（easy 难度首障约 7 秒到达，留足余量）
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

  // 1. 时长-分数一致性：score 不应超过时长允许的上限
  if (playedMs < score * 60) {
    return { ok: false, error: '游戏时长与分数不匹配', code: 400 };
  }

  // 2. 输入频率：分数越高应累计越多输入，AFK 刷分 inputCount 会很低
  if (inputCount < Math.floor(score / 30)) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }

  // 3. AFK 检测：最长无操作间隔不超过 10 秒
  if (maxNoInputMs >= 10000) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }

  return { ok: true };
}

/**
 * buster-montage 专用反作弊校验（弹弹珠游戏）
 *
 * 得分来源：击碎砖块（10/20/30/40/50/100 分）+ 通关奖励（lives * 100）
 * 攻击面：篡改砖块数量/挡板宽度/生命数/砖块分值
 *
 * 客户端在 extra.antiCheat 中附带游戏状态快照：
 *   - bricksDestroyed：击碎砖块数
 *   - totalBricks：该难度标准总砖块数
 *   - finalLives：结束时生命数
 *   - won：是否通关（布尔）
 *   - maxPaddleWidth：游戏中挡板最大宽度（含 wide 道具加宽）
 *   - playedMs：游戏时长（毫秒）
 *   - inputCount：输入次数
 *   - maxNoInputMs：最长无操作间隔（毫秒）
 *
 * 校验规则：
 *   1. 难度合法性：difficulty 必须是 easy/normal/hard
 *   2. 总砖块数一致性：totalBricks 必须匹配服务端配置（防篡改砖块总数）
 *   3. 击碎数上限：bricksDestroyed <= totalBricks（防恶意添加砖块）
 *   4. 通关一致性：won ⟺ bricksDestroyed === totalBricks
 *   5. 生命数范围：0 <= finalLives <= 5（life 道具上限 5）
 *   6. 挡板宽度上限：maxPaddleWidth <= paddleWidth * 2.5（wide 道具可叠加加宽，留余量）
 *   7. 分数上限：score <= 理论最高分（防篡改砖块分值/生命数）
 *   8. 时长下限：playedMs >= 3000（防秒通关脚本）
 *   9. AFK 检测：maxNoInputMs < 15000（弹珠球节奏比跑酷慢，15 秒阈值）
 *   10. 输入下限：inputCount >= 3（至少几次操作）
 */
const BUSTER_CONFIGS = {
  easy:   { brickRows: 3, brickCols: 7, totalBricks: 21, paddleWidth: 120 },
  normal: { brickRows: 4, brickCols: 8, totalBricks: 32, paddleWidth: 100 },
  hard:   { brickRows: 5, brickCols: 9, totalBricks: 45, paddleWidth: 80 }
};
const BUSTER_BRICK_POINTS = [10, 20, 30, 40, 50, 100];
const BUSTER_MAX_LIVES = 5;
const BUSTER_WIDE_TOLERANCE = 2.5; // wide 道具可叠加，留 2.5 倍余量

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

function verifyBusterAntiCheat(score, ac, extra) {
  const difficulty = extra && extra.difficulty;
  if (!difficulty || !BUSTER_CONFIGS[difficulty]) {
    return { ok: false, error: '难度非法或缺失', code: 400 };
  }
  const config = BUSTER_CONFIGS[difficulty];

  // won 字段（布尔类型，单独校验）
  if (typeof ac.won !== 'boolean') {
    return { ok: false, error: 'antiCheat.won 字段格式错误', code: 400 };
  }
  const won = ac.won;

  // 数值字段提取与格式校验
  const numFields = ['bricksDestroyed', 'totalBricks', 'finalLives', 'maxPaddleWidth', 'playedMs', 'inputCount', 'maxNoInputMs'];
  const v = {};
  for (const f of numFields) {
    v[f] = Number(ac[f]);
    if (!Number.isFinite(v[f])) {
      return { ok: false, error: `antiCheat.${f} 字段格式错误`, code: 400 };
    }
    if (v[f] < 0) {
      return { ok: false, error: `antiCheat.${f} 字段非法（负数）`, code: 400 };
    }
  }

  // 1. 总砖块数一致性：客户端上报的 totalBricks 必须匹配服务端配置
  if (v.totalBricks !== config.totalBricks) {
    return { ok: false, error: '砖块总数与难度配置不符', code: 400 };
  }
  // 2. 击碎砖块数上限：bricksDestroyed <= totalBricks（防恶意添加砖块）
  if (v.bricksDestroyed > v.totalBricks) {
    return { ok: false, error: '击碎砖块数超过总数', code: 400 };
  }
  // 3. 通关一致性：won=true ⟺ bricksDestroyed === totalBricks
  if (won && v.bricksDestroyed !== v.totalBricks) {
    return { ok: false, error: '通关状态与击碎砖块数不一致', code: 400 };
  }
  if (!won && v.bricksDestroyed === v.totalBricks) {
    return { ok: false, error: '击碎所有砖块但未通关（状态异常）', code: 400 };
  }
  // 4. 通关时生命数至少 1（winGame 时 lives >= 1，否则会先触发 gameOver）
  if (won && v.finalLives < 1) {
    return { ok: false, error: '通关时生命数异常', code: 400 };
  }
  // 5. 生命数上限：life 道具上限 5
  if (v.finalLives > BUSTER_MAX_LIVES) {
    return { ok: false, error: '生命数超过上限', code: 400 };
  }
  // 6. 挡板宽度上限：防恶意扩大挡板（wide 道具可叠加，留 2.5 倍余量）
  if (v.maxPaddleWidth > config.paddleWidth * BUSTER_WIDE_TOLERANCE) {
    return { ok: false, error: '挡板宽度异常', code: 400 };
  }
  // 7. 分数上限：score <= 理论最高分（防篡改砖块分值/生命数）
  const maxScore = computeBusterMaxScore(difficulty, won);
  if (score > maxScore) {
    return { ok: false, error: '分数超过理论上限', code: 400 };
  }
  // 8. 时长下限：至少 3 秒（防秒通关脚本）
  if (v.playedMs < 3000) {
    return { ok: false, error: '游戏时长过短', code: 400 };
  }
  // 9. AFK 检测：弹珠球节奏比跑酷慢，15 秒阈值
  if (v.maxNoInputMs >= 15000) {
    return { ok: false, error: '检测到长时间无操作', code: 400 };
  }
  // 10. 输入下限：至少 3 次操作
  if (v.inputCount < 3) {
    return { ok: false, error: '输入次数异常', code: 400 };
  }
  return { ok: true };
}

module.exports = {
  verifySubmission,
  verifyAntiCheat,
  computeSignature,
  // 暴露供测试：清理 nonce 缓存
  _resetNonceStore() {
    nonceStore.clear();
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  },
  // 暴露供测试：计算 buster 理论最高分
  _computeBusterMaxScore: computeBusterMaxScore
};
