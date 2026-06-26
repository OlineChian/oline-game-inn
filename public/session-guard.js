/**
 * 会话保护模块（基于 History API）
 *
 * 三重防护：
 *   1. 会话标识：游戏开始时 pushState 写入 { gameId, sessionStart, nonce }，
 *      提交分数时 verifySession 校验 history.state 完整性，防止跨页面伪造
 *   2. 后退拦截：监听 popstate，游戏进行中阻止浏览器后退重置状态刷分
 *   3. 注入检测：缓存 pushState/replaceState 原始引用，detectInjection 时比较
 *      是否被恶意脚本覆盖（如外挂劫持导航），检测到则弹窗并标记
 *
 * 用法：
 *   const guard = SessionGuard.start('buster-montage');
 *   // 游戏循环中可选：if (SessionGuard.detectInjection()) { alert(...) }
 *   // 提交前：const ok = SessionGuard.verify();
 *   SessionGuard.end(); // 游戏结束释放
 */
(function (global) {
  'use strict';

  // 当前活跃会话
  let activeSession = null;
  // 缓存原始方法引用（用于注入检测）
  const nativePushState = history.pushState ? history.pushState.bind(history) : null;
  const nativeReplaceState = history.replaceState ? history.replaceState.bind(history) : null;
  // popstate 监听是否已绑定
  let popstateBound = false;
  // 用户回调（后退被拦截时通知游戏）
  let backInterceptedCb = null;

  function generateNonce() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * 启动会话保护
   * @param {string} gameId - 游戏标识
   * @returns {object} session 句柄（含 nonce/sessionStart 供提交时附带）
   */
  function start(gameId) {
    // 若已有活跃会话，先结束
    if (activeSession) end();

    const sessionStart = Date.now();
    const nonce = generateNonce();
    const state = { gameId: gameId, sessionStart: sessionStart, sessionNonce: nonce, guard: true };

    try {
      // 用 replaceState 而非 pushState，避免新增历史条目（用户后退会回到首页）
      // 当前页状态被替换为受保护状态
      if (nativeReplaceState) {
        nativeReplaceState(state, '', global.location.href);
      }
    } catch (e) {
      // 某些浏览器在跨域或 iframe 中会拒绝 pushState，静默降级
    }

    activeSession = { gameId: gameId, sessionStart: sessionStart, nonce: nonce };

    // 绑定 popstate 拦截（只绑一次）
    if (!popstateBound) {
      global.addEventListener('popstate', function (event) {
        if (!activeSession) return;
        // 游戏进行中，阻止后退：重新 pushState 回当前页
        // 注意 popstate 后 history.state 已变为上一条，需要重新写入保护状态
        try {
          if (nativeReplaceState) {
            nativeReplaceState(
              { gameId: activeSession.gameId, sessionStart: activeSession.sessionStart, sessionNonce: activeSession.nonce, guard: true, blocked: true },
              '',
              global.location.href
            );
          }
        } catch (e) { /* ignore */ }
        if (typeof backInterceptedCb === 'function') {
          backInterceptedCb(activeSession.gameId);
        }
      });
      popstateBound = true;
    }

    return activeSession;
  }

  /**
   * 校验当前会话是否完整（提交分数前调用）
   * @returns {{ok:boolean, session?:object, reason?:string}}
   */
  function verify() {
    if (!activeSession) {
      return { ok: false, reason: '无活跃会话（未调用 start 或已 end）' };
    }
    const st = history.state;
    if (!st || typeof st !== 'object') {
      return { ok: false, reason: 'history.state 缺失或非法' };
    }
    if (st.gameId !== activeSession.gameId) {
      return { ok: false, reason: '会话 gameId 不匹配' };
    }
    if (st.sessionStart !== activeSession.sessionStart) {
      return { ok: false, reason: '会话起始时间被篡改' };
    }
    if (st.sessionNonce !== activeSession.nonce) {
      return { ok: false, reason: '会话 nonce 不匹配' };
    }
    // 会话时长合理性校验（防伪造远古会话）
    const elapsed = Date.now() - activeSession.sessionStart;
    if (elapsed < 0) {
      return { ok: false, reason: '会话时间异常' };
    }
    // 上限 2 小时（防止挂机刷会话）
    if (elapsed > 2 * 60 * 60 * 1000) {
      return { ok: false, reason: '会话超时（超过 2 小时）' };
    }
    return { ok: true, session: activeSession };
  }

  /**
   * 检测 history.pushState/replaceState 是否被恶意脚本覆盖
   * @returns {boolean} true 表示检测到注入
   */
  function detectInjection() {
    if (nativePushState && history.pushState !== nativePushState) return true;
    if (nativeReplaceState && history.replaceState !== nativeReplaceState) return true;
    return false;
  }

  /**
   * 结束会话（游戏结束或离开页面时调用）
   */
  function end() {
    activeSession = null;
    backInterceptedCb = null;
  }

  global.SessionGuard = {
    start: start,
    verify: verify,
    end: end,
    detectInjection: detectInjection,
    onBackIntercepted: function (cb) { backInterceptedCb = cb; }
  };
})(window);
