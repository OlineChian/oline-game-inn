/**
 * 失败提交记录模块
 *
 * 职责：
 *   1. POST /api/leaderboard/:game 在任意非成功响应时记录原始提交数据
 *   2. 提供列表 / 单条查询 / 重新上传 / 删除 API（管理员）
 *   3. 重新上传走 service.submitScore 直接入库，绕过签名与反作弊校验
 *      （管理员人工审核后手动放行，恢复玩家因误判或服务异常丢失的成绩）
 *
 * 存储结构（leaderboard partitioned store 单 key 数组）：
 *   failed:submissions → [record, ...]
 *     record = {
 *       id, at, gameId, nickname, score, extra, ip,
 *       error, status, category, payload, uploaded
 *     }
 *
 * category 取值：
 *   'signature' — L1/L2 签名/时间窗/nonce 校验失败
 *   'security'  — L3 反作弊校验失败（warned 或 banned，已记入 penalty:log，此处仅作成绩恢复入口）
 *   'service'   — service.submitScore 业务返回 400/404（分数非法/游戏未找到等）
 *   'unknown'   — 其他未分类错误
 *
 * 容量上限：FAILED_MAX_RECORDS = 500，超出按时间正序淘汰最旧记录
 */

const FAILED_KEY = 'failed:submissions';
const FAILED_MAX_RECORDS = 500;

/**
 * 记录一次失败提交
 * @param {object} storage - leaderboard partitioned store
 * @param {object} info - { gameId, nickname, score, extra, ip, error, status, category, payload }
 * @returns {string} 新记录 id
 */
function recordFailure(storage, info) {
  if (!storage || !info) return null;
  const id = 'fs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const record = {
    id: id,
    at: Date.now(),
    gameId: info.gameId || '',
    nickname: info.nickname || '',
    score: Number(info.score) || 0,
    extra: info.extra || null,
    ip: info.ip || '',
    error: info.error || '未知错误',
    status: Number(info.status) || 0,
    category: info.category || 'unknown',
    payload: info.payload || null,
    uploaded: false
  };
  const list = storage.get(FAILED_KEY) || [];
  list.push(record);
  // 容量限制：按时间正序淘汰最旧记录
  if (list.length > FAILED_MAX_RECORDS) {
    list.splice(0, list.length - FAILED_MAX_RECORDS);
  }
  storage.set(FAILED_KEY, list);
  console.warn('[failed-submissions] 记录失败提交 id=' + id +
    ' game=' + record.gameId + ' nickname=' + record.nickname +
    ' score=' + record.score + ' category=' + record.category +
    ' error=' + record.error);
  return id;
}

/**
 * 列出所有失败提交（按时间倒序）
 * @param {object} storage
 * @param {object} [opts] - { category?: string, uploaded?: bool }
 */
function listFailed(storage, opts) {
  if (!storage) return [];
  const list = storage.get(FAILED_KEY) || [];
  let result = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  if (opts && opts.category) {
    result = result.filter(r => r.category === opts.category);
  }
  if (opts && typeof opts.uploaded === 'boolean') {
    result = result.filter(r => !!r.uploaded === opts.uploaded);
  }
  return result;
}

/** 根据 id 取单条记录 */
function getFailed(storage, id) {
  if (!storage || !id) return null;
  const list = storage.get(FAILED_KEY) || [];
  return list.find(r => r.id === id) || null;
}

/** 标记记录为已重新上传 */
function markUploaded(storage, id) {
  if (!storage || !id) return false;
  const list = storage.get(FAILED_KEY) || [];
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return false;
  list[idx].uploaded = true;
  list[idx].uploadedAt = Date.now();
  storage.set(FAILED_KEY, list);
  return true;
}

/** 删除单条记录 */
function deleteFailed(storage, id) {
  if (!storage || !id) return false;
  const list = storage.get(FAILED_KEY) || [];
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  storage.set(FAILED_KEY, list);
  return true;
}

module.exports = {
  recordFailure,
  listFailed,
  getFailed,
  markUploaded,
  deleteFailed,
  FAILED_KEY,
  FAILED_MAX_RECORDS
};
