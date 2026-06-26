/**
 * 排行榜成绩提交安全验证模块
 *
 * 防御层级：
 *   L1. HMAC-SHA256 签名校验 —— 防止抓包后直接修改 score 值
 *   L2. timestamp 时间窗口 + nonce 一次性 —— 防止重放
 *   L3. antiCheat 游戏状态快照校验 —— 防止游戏内状态篡改（委托 anti-cheat.js）
 *   L4. 作弊者封禁系统 —— 检测到作弊后封禁 IP + 可选清除历史成绩
 *
 * 密钥策略：
 *   - 服务端读 SCORE_SIGN_SECRET 环境变量；未设置时使用默认值（仅开发环境）
 *   - 客户端硬编码同一密钥（public/score-signer.js），会被反编译，属已知局限
 *   - HMAC key = SECRET + ':' + gameId，按游戏派生，单游戏密钥泄露不影响其他游戏
 *
 * 签名内容：gameId|nickname|score|timestamp|nonce
 */

const crypto = require('crypto');
const { verifyGameAntiCheat } = require('./anti-cheat');

// 开发环境 fallback 密钥；生产必须通过环境变量 SCORE_SIGN_SECRET 覆盖
const DEFAULT_SECRET = 'oline-score-sign-dev-default';
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000;
const NONCE_MAX_SIZE = 10000;

let secretWarned = false;

function getSecret() {
  const secret = process.env.SCORE_SIGN_SECRET;
  if (!secret) {
    if (!secretWarned) {
      secretWarned = true;
      console.warn('[security] SCORE_SIGN_SECRET 未设置，使用默认开发密钥。生产环境必须设置该环境变量！');
    }
    return DEFAULT_SECRET;
  }
  return secret;
}

function deriveKey(secret, gameId) { return secret + ':' + gameId; }

function computeSignature(secret, gameId, payload) {
  const key = deriveKey(secret, gameId);
  const message = [
    payload.gameId, payload.nickname, String(payload.score),
    String(payload.timestamp), payload.nonce
  ].join('|');
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ==================== nonce 防重放 ====================

const nonceStore = new Map();
let cleanupTimer = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredNonces, NONCE_CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
}

function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [n, expireAt] of nonceStore) {
    if (expireAt <= now) nonceStore.delete(n);
  }
}

function isNonceUsed(nonce) {
  const now = Date.now();
  const expireAt = nonceStore.get(nonce);
  if (expireAt && expireAt > now) return true;
  nonceStore.set(nonce, now + NONCE_TTL_MS);
  ensureCleanupTimer();
  if (nonceStore.size > NONCE_MAX_SIZE) cleanupExpiredNonces();
  return false;
}

// ==================== L1+L2: 签名 + 时间窗口 + nonce ====================

/**
 * 验证提交请求的签名、时间戳、nonce
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
  const now = Date.now();
  if (Math.abs(now - ts) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, error: '请求已过期', code: 400 };
  }
  const expected = computeSignature(getSecret(), gameId, {
    gameId, nickname, score, timestamp, nonce
  });
  if (!safeEqualHex(expected, String(signature))) {
    return { ok: false, error: '签名校验失败', code: 400 };
  }
  if (isNonceUsed(String(nonce))) {
    return { ok: false, error: '请求已提交（请勿重复提交）', code: 400 };
  }
  return { ok: true };
}

// ==================== L3: 游戏状态快照校验（委托 anti-cheat.js）====================

/**
 * 反作弊遥测校验分发器
 * 无 extra.antiCheat 字段时跳过（向后兼容）；有则委托 anti-cheat.js 按 gameId 分发
 */
function verifyAntiCheat(gameId, body) {
  const extra = body && body.extra;
  const ac = extra && extra.antiCheat;
  if (!ac) return { ok: true };
  const score = Number(body.score);
  if (!Number.isFinite(score)) {
    return { ok: false, error: 'score 格式错误', code: 400 };
  }
  return verifyGameAntiCheat(gameId, score, ac, extra);
}


// ==================== L4: 作弊者封禁系统 ====================
//
// 存储结构：
//   ban:ip:{ip} → { until, reason, at, action }
//     until：封禁到期时间戳；过期自动失效（不主动清理，checkBan 判定即可）
//     action：'ban'（仅封禁 7 天）| 'purge'（清除成绩 + 封禁 30 天）
//   purge:ip:{ip} → true（标记需要清除该 IP 的历史成绩，service.getBoard 时消费）
//
// 惩罚措施：
//   - ban：POST 路由 checkBan 拒绝封禁期内 IP 提交
//   - purge：标记后，service 读取排行榜时过滤掉该 IP 的记录；同时 POST 拒绝
//
// 设计权衡：用最小代码实现"封禁 + 清除成绩"，复用现有 storage 抽象，不新建表/文件。

const BAN_KEY_PREFIX = 'ban:ip:';
const PURGE_KEY_PREFIX = 'purge:ip:';
const BAN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;       // 7 天
const PURGE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;    // 30 天

/**
 * 检查 IP 是否被封禁
 * @param {object} storage - leaderboard 的 partitioned store
 * @param {string} ip
 * @returns {{banned:boolean, until?:number, reason?:string, action?:string}}
 */
function checkBan(storage, ip) {
  if (!storage || !ip) return { banned: false };
  const rec = storage.get(BAN_KEY_PREFIX + ip);
  if (!rec) return { banned: false };
  const now = Date.now();
  if (rec.until <= now) return { banned: false }; // 已过期
  return { banned: true, until: rec.until, reason: rec.reason, action: rec.action };
}

/**
 * 标记作弊者（触发封禁 + 可选清除成绩）
 * @param {object} storage - leaderboard 的 partitioned store
 * @param {string} ip
 * @param {string} reason - 封禁原因
 * @param {string} action - 'ban'（默认）或 'purge'
 */
function flagCheater(storage, ip, reason, action) {
  if (!storage || !ip) return;
  action = action || 'ban';
  const now = Date.now();
  const until = now + (action === 'purge' ? PURGE_DURATION_MS : BAN_DURATION_MS);
  storage.set(BAN_KEY_PREFIX + ip, { until: until, reason: reason, at: now, action: action });
  if (action === 'purge') {
    // 标记需要清除历史成绩（service.getBoard 时消费）
    storage.set(PURGE_KEY_PREFIX + ip, true);
  }
  console.warn('[security] 作弊者已封禁 IP=' + ip + ' reason=' + reason + ' action=' + action + ' until=' + new Date(until).toISOString());
}

/**
 * 检查某 IP 是否被标记为需要清除成绩
 * @returns {boolean}
 */
function shouldPurge(storage, ip) {
  if (!storage || !ip) return false;
  return storage.get(PURGE_KEY_PREFIX + ip) === true;
}

/**
 * 清除标记（成绩清除完成后调用）
 */
function clearPurgeFlag(storage, ip) {
  if (!storage || !ip) return;
  storage.delete(PURGE_KEY_PREFIX + ip);
}

module.exports = {
  verifySubmission,
  verifyAntiCheat,
  computeSignature,
  checkBan,
  flagCheater,
  shouldPurge,
  clearPurgeFlag,
  BAN_KEY_PREFIX,
  PURGE_KEY_PREFIX,
  // 暴露供测试：清理 nonce 缓存
  _resetNonceStore() {
    nonceStore.clear();
    if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
  }
};
