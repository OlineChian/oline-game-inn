/**
 * 统一弹窗与暂停管理（单一弹窗栈，避免多弹窗互相覆盖导致死锁）
 *
 * 设计要点：
 * - 同一时刻仅允许一个弹窗打开；已有弹窗时新弹窗被拒绝（调用方应提示用户）
 * - 阻塞型弹窗（hero-select / buff-select / game-over / continue）不可被暂停按钮关闭
 * - 可关闭弹窗（unlock / settings / facility / vault / merge / retire）可被暂停按钮一键关闭恢复
 * - 游戏暂停态由「弹窗是否打开」与「玩家手动暂停」共同决定，统一同步到 Game.state.paused
 * - 暂停按钮始终位于最高 UI 层（z-index 9999），永不隐藏
 *
 * 为避免与 core/game.js 形成循环依赖，本模块不直接 import Game，
 * 暂停态写入通过 setPauseSetter 注入的回调完成。
 */
const SHARED_MODAL_ID = 'bf-modal';

export const ModalManager = {
  _current: null,         // { type, blocking, shared, onClose }
  _manualPause: false,
  _pauseSetter: null,

  /** 注入暂停态写入回调（由 main.js 注册：p => Game.state.paused = p） */
  setPauseSetter(fn) { this._pauseSetter = fn; },

  hasOpen() { return this._current !== null; },
  isOpen(type) { return !!this._current && this._current.type === type; },
  isBlocking() { return !!this._current && this._current.blocking; },
  currentType() { return this._current ? this._current.type : null; },

  /** 是否处于暂停（弹窗打开或手动暂停） */
  isPaused() { return this._current !== null || this._manualPause; },

  /**
   * 打开弹窗。若已有弹窗打开则拒绝（返回 false），调用方应据此提示用户。
   * @param {string} type 弹窗类型标识
   * @param {Object} opts { blocking=false, shared=false, onClose=null }
   *   - blocking: 阻塞型（不可被暂停按钮关闭，必须完成交互）
   *   - shared: 使用共享 #bf-modal 容器（由本管理器控制显隐）
   *   - onClose: 被暂停按钮强制关闭时的清理回调（动态弹窗用于移除自身 DOM）
   */
  open(type, opts = {}) {
    if (this._current) return false;
    const { blocking = false, shared = false, onClose = null } = opts;
    this._current = { type, blocking, shared, onClose };
    if (shared) this._showShared();
    this._syncPause();
    return true;
  },

  /** 关闭指定类型弹窗（类型不匹配则忽略，返回 false） */
  close(type) {
    if (!this._current || this._current.type !== type) return false;
    const c = this._current;
    this._current = null;
    if (c.shared) this._hideShared();
    this._syncPause();
    return true;
  },

  /** 暂停按钮点击：关闭可关闭弹窗以恢复，或切换手动暂停 */
  togglePauseOrDismiss() {
    if (this._current) {
      if (this._current.blocking) { this._syncPause(); return; }  // 阻塞型：必须完成交互
      // 强制关闭可关闭弹窗并恢复游戏
      const c = this._current;
      this._current = null;
      if (c.shared) this._hideShared();
      if (typeof c.onClose === 'function') { try { c.onClose(); } catch (e) { /* ignore */ } }
      this._manualPause = false;
      this._syncPause();
      return;
    }
    this._manualPause = !this._manualPause;
    this._syncPause();
  },

  /** 显式设置手动暂停（恢复流程后清零用） */
  setManualPause(v) { this._manualPause = !!v; this._syncPause(); },

  _showShared() { const el = document.getElementById(SHARED_MODAL_ID); if (el) el.classList.remove('hidden'); },
  _hideShared() { const el = document.getElementById(SHARED_MODAL_ID); if (el) el.classList.add('hidden'); },

  _syncPause() {
    const paused = this.isPaused();
    if (typeof this._pauseSetter === 'function') this._pauseSetter(paused);
    document.dispatchEvent(new CustomEvent('bf-pause-change', { detail: { paused } }));
  }
};
