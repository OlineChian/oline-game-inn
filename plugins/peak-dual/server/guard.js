'use strict';

/**
 * 巅峰双重挑战 - 防作弊工具
 * - validateTag: Player Tag 格式校验
 * - checkRateLimit: 频率限制（按 IP）
 * - logAction: 操作日志记录
 * - getClientIp / getUserAgent: 请求信息提取
 */

const TAG_PATTERN = /^#[0289PYLQGRJCUV]{2,14}$/;
const QUERY_INTERVAL = 10000;
const DRAW_INTERVAL = 60000;

function validateTag(tag) {
  return TAG_PATTERN.test(tag || '');
}

function checkRateLimit(storage, ip, action) {
  if (!ip) return { ok: true };
  const key = `ratelimit:${ip}:${action}`;
  const last = storage.get(key);
  const now = Date.now();
  const interval = action === 'draw' ? DRAW_INTERVAL : QUERY_INTERVAL;
  if (last && (now - last) < interval) {
    return { ok: false, retryAfter: Math.ceil((interval - (now - last)) / 1000) };
  }
  storage.set(key, now);
  return { ok: true };
}

function logAction(storage, playerTag, entry) {
  const key = `logs:${playerTag}`;
  const logs = storage.get(key) || [];
  logs.push(entry);
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  storage.set(key, logs);
}

function getClientIp(req) {
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || '';
}

function getUserAgent(req) {
  return String(req.headers && req.headers['user-agent'] || '').slice(0, 200);
}

module.exports = {
  validateTag, checkRateLimit, logAction,
  getClientIp, getUserAgent, TAG_PATTERN
};
