/**
 * 切斯特牌 - 临时存档系统（localStorage，24h 过期）
 *
 * 仅保存游戏进度关键字段，不保存牌库/手牌/选中状态等瞬态数据。
 * 读取时若已过期，自动清除并返回 null。
 */

const STORAGE_KEY = 'chester-cards:save';
const TTL_MS = 24 * 60 * 60 * 1000;  // 24 小时

/**
 * 从 State 提取可序列化的存档数据
 * @param {Object} state 游戏 State
 * @returns {Object} 存档 state
 */
function serialize(state) {
  return {
    round: state.round,
    totalScore: state.totalScore,
    coins: state.coins,
    candies: (state.candies || []).map(c => c.id),
    handLevels: { ...(state.handLevels || {}) },
    shopLevel: state.shopLevel || 1
  };
}

/**
 * 保存游戏进度（覆盖式）
 * @param {Object} state 游戏 State
 */
export function saveGame(state) {
  const payload = {
    savedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
    state: serialize(state)
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // localStorage 不可用（隐私模式等）— 静默失败
  }
}

/**
 * 读取存档（过期自动清除并返回 null）
 * @returns {Object|null} { savedAt, expiresAt, state }
 */
export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.expiresAt || !payload.state) {
      clearSave();
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      clearSave();
      return null;
    }
    return payload;
  } catch (e) {
    clearSave();
    return null;
  }
}

/**
 * 是否存在有效存档（未过期）
 * @returns {boolean}
 */
export function hasSave() {
  return loadGame() !== null;
}

/**
 * 清除存档
 */
export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // 静默失败
  }
}

/**
 * 获取存档剩余有效时间（毫秒）
 * @returns {number} 剩余毫秒；无存档或已过期返回 0
 */
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
