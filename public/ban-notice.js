/**
 * 安全事件提示弹窗（客户端公共模块）
 *
 * 当服务端 POST /api/leaderboard/:game 返回任意非成功响应时：
 *   - 403 banned：IP 被封禁 → show() 封禁弹窗（含联系管理员按钮）
 *   - 200 warned：第1次违规警告，成绩不上传 → showWarning() 警告弹窗
 *   - 400/401/404/500 其他错误 → showError() 错误弹窗（含失败原因 + 联系管理员按钮）
 *   - 200 success:true：正常成功，不弹窗
 *
 * 用法：
 *   // 统一入口（推荐，自动区分 banned/warned/error）
 *   if (window.BanNotice && await window.BanNotice.handleSecurityEvent(response)) return;
 *
 *   // 手动调用
 *   if (data.banned) window.BanNotice.show(data);
 *   else if (data.warned) window.BanNotice.showWarning(data);
 *   else window.BanNotice.showError(data, status);
 *
 * 依赖：无（纯 vanilla JS，CSS 变量降级）
 */
(function (global) {
  'use strict';

  // 与首页"提交反馈"按钮一致（index.html bottom-links）
  var ADMIN_CONTACT_URL = 'https://qm.qq.com/q/w5F7DvE0Pm';

  var modalEl = null;
  var styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    var style = document.createElement('style');
    style.id = 'ban-notice-style';
    style.textContent =
'.ban-notice-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100000;animation:ban-fade .25s ease}' +
'.ban-notice-box{background:var(--bg-surface,#fff);color:var(--text-primary,#333);padding:28px 32px;border-radius:12px;max-width:92vw;width:420px;box-shadow:0 12px 40px rgba(0,0,0,.4);text-align:center;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box}' +
'.ban-notice-icon{margin:0 auto 12px;display:block}' +
'.ban-notice-title{font-size:18px;font-weight:700;margin-bottom:12px}' +
'.ban-notice-title-ban{color:var(--color-danger,#d32f2f)}' +
'.ban-notice-title-warn{color:var(--color-warn,#f57c00)}' +
'.ban-notice-msg{font-size:14px;color:var(--text-primary,#333);line-height:1.6;margin-bottom:16px}' +
'.ban-notice-meta{font-size:12px;color:var(--text-secondary,#888);line-height:1.7;margin-bottom:20px;padding:10px 12px;background:rgba(0,0,0,.04);border-radius:6px;text-align:left;word-break:break-all}' +
'.ban-notice-meta strong{color:var(--text-primary,#333);font-weight:600}' +
'.ban-notice-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
'.ban-notice-btn{padding:10px 24px;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:opacity .15s;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}' +
'.ban-notice-btn-primary{background:var(--color-primary,#1976d2);color:#fff}' +
'.ban-notice-btn-primary:hover{opacity:.85}' +
'.ban-notice-btn-secondary{background:transparent;color:var(--text-secondary,#888);border:1px solid var(--border-color,#ddd)}' +
'.ban-notice-btn-secondary:hover{background:rgba(0,0,0,.04)}' +
'@keyframes ban-fade{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(style);
    styleInjected = true;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function formatDate(ts) {
    var n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '-';
    var d = new Date(n);
    if (isNaN(d.getTime())) return '-';
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // SVG 警告图标（三角感叹号），符合"纯 HTML/CSS/SVG"约束
  function warnIcon(color) {
    return '<svg class="ban-notice-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 2L1 21h22L12 2z" fill="' + color + '" opacity=".15"/>' +
      '<path d="M12 2L1 21h22L12 2z" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" fill="none"/>' +
      '<rect x="11" y="9" width="2" height="6" rx="1" fill="' + color + '"/>' +
      '<circle cx="12" cy="18" r="1.2" fill="' + color + '"/>' +
      '</svg>';
  }

  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function showModal(html) {
    injectStyle();
    closeModal();
    modalEl = document.createElement('div');
    modalEl.className = 'ban-notice-overlay';
    modalEl.innerHTML = html;
    document.body.appendChild(modalEl);
    var closeBtn = modalEl.querySelector('.ban-notice-btn-secondary');
    if (closeBtn) closeBtn.onclick = closeModal;
    // 点击遮罩关闭
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) closeModal();
    });
  }

  /** 封禁弹窗（IP 已被封禁，含联系管理员按钮） */
  function show(data) {
    data = data || {};
    var reason = data.banReason || data.error || '检测到不正当游戏行为';
    var until = data.banUntil ? formatDate(data.banUntil) : '-';
    var nickname = data.nickname || '';
    var meta =
      '<div class="ban-notice-meta">' +
      (nickname ? '<div><strong>昵称：</strong>' + escapeHtml(nickname) + '</div>' : '') +
      '<div><strong>封禁原因：</strong>' + escapeHtml(reason) + '</div>' +
      '<div><strong>解禁时间：</strong>' + escapeHtml(until) + '</div>' +
      '</div>';
    showModal(
      '<div class="ban-notice-box">' +
      warnIcon('#d32f2f') +
      '<div class="ban-notice-title ban-notice-title-ban">账号暂时无法提交成绩</div>' +
      '<div class="ban-notice-msg">系统可能检测到不正当游戏行为，这不是你的错。如需解禁请联系管理员。</div>' +
      meta +
      '<div class="ban-notice-actions">' +
      '<a class="ban-notice-btn ban-notice-btn-primary" href="' + ADMIN_CONTACT_URL + '" target="_blank" rel="noopener">联系管理员</a>' +
      '<button class="ban-notice-btn ban-notice-btn-secondary" type="button">关闭</button>' +
      '</div></div>'
    );
  }

  /** 警告弹窗（第1次违规，成绩未上传，未封禁） */
  function showWarning(data) {
    data = data || {};
    var reason = data.reason || data.error || '检测到异常游戏行为';
    var count = data.violationCount || 1;
    var meta =
      '<div class="ban-notice-meta">' +
      '<div><strong>违规原因：</strong>' + escapeHtml(reason) + '</div>' +
      '<div><strong>当前违规次数：</strong>' + escapeHtml(count) + ' 次</div>' +
      '</div>';
    showModal(
      '<div class="ban-notice-box">' +
      warnIcon('#f57c00') +
      '<div class="ban-notice-title ban-notice-title-warn">本次成绩未上传</div>' +
      '<div class="ban-notice-msg">系统检测到异常游戏行为，本次成绩未计入排行榜。请规范游戏操作，多次违规将导致账号暂时封禁。</div>' +
      meta +
      '<div class="ban-notice-actions">' +
      '<button class="ban-notice-btn ban-notice-btn-secondary" type="button">我知道了</button>' +
      '</div></div>'
    );
  }

  /**
   * 通用错误弹窗（签名失败、游戏未找到、服务异常等所有非 banned/warned 情况）
   * 含失败原因 + 联系管理员按钮
   * @param {object} data - 响应体
   * @param {number} status - HTTP 状态码
   */
  function showError(data, status) {
    data = data || {};
    var reason = data.error || data.reason || '未知错误';
    var statusText = ({
      400: '请求无效 (400)',
      401: '未授权 (401)',
      404: '游戏未找到 (404)',
      500: '服务器错误 (500)',
      502: '网关错误 (502)',
      503: '服务不可用 (503)'
    })[status] || ('错误 (' + status + ')');
    var meta =
      '<div class="ban-notice-meta">' +
      '<div><strong>失败原因：</strong>' + escapeHtml(reason) + '</div>' +
      '<div><strong>状态码：</strong>' + escapeHtml(statusText) + '</div>' +
      '</div>';
    showModal(
      '<div class="ban-notice-box">' +
      warnIcon('#d32f2f') +
      '<div class="ban-notice-title ban-notice-title-ban">成绩提交失败</div>' +
      '<div class="ban-notice-msg">本次成绩未能上传到排行榜。这可能是网络波动或服务异常导致的。如问题持续出现，请联系管理员协助处理。</div>' +
      meta +
      '<div class="ban-notice-actions">' +
      '<a class="ban-notice-btn ban-notice-btn-primary" href="' + ADMIN_CONTACT_URL + '" target="_blank" rel="noopener">联系管理员</a>' +
      '<button class="ban-notice-btn ban-notice-btn-secondary" type="button">关闭</button>' +
      '</div></div>'
    );
  }

  /**
   * 统一处理安全事件（推荐入口）
   * 自动区分 403 封禁 / 200 警告 / 其他错误，弹对应弹窗
   * 200 且 success:true 视为正常成功，不弹窗
   * @param {Response} response - fetch 返回的 Response 对象
   * @returns {Promise<boolean>} true 表示已弹窗（应中止后续逻辑），false 表示非安全事件
   */
  async function handleSecurityEvent(response) {
    if (!response) return false;
    var status = response.status;
    var data;
    try {
      data = await response.clone().json();
    } catch (_) {
      try { data = { error: await response.clone().text() }; }
      catch (e2) { data = {}; }
    }
    if (!data) data = {};

    // 正常成功：200 且 success:true → 不弹窗
    if (status === 200 && data.success === true) return false;

    // 封禁：403 且 banned=true，或 error 含"封禁"
    if (status === 403 && (data.banned === true ||
        (typeof data.error === 'string' && data.error.indexOf('封禁') >= 0))) {
      show(data);
      return true;
    }
    // 警告：200 且 warned=true
    if (status === 200 && data.warned === true) {
      showWarning(data);
      return true;
    }
    // 其他所有非成功情况：400/401/404/500/502/503，以及 200 success:false 但非 warned
    if (status !== 200 || data.success === false) {
      showError(data, status);
      return true;
    }
    return false;
  }

  /** 旧接口（仅处理 403 封禁），向后兼容 */
  async function handleIfBanned(response) {
    if (!response || response.status !== 403) return false;
    var data;
    try { data = await response.clone().json(); }
    catch (_) {
      try { data = { error: await response.clone().text() }; }
      catch (e2) { data = {}; }
    }
    if (data && (data.banned === true ||
        (typeof data.error === 'string' && data.error.indexOf('封禁') >= 0))) {
      show(data);
      return true;
    }
    return false;
  }

  global.BanNotice = {
    show: show,
    showWarning: showWarning,
    showError: showError,
    handleSecurityEvent: handleSecurityEvent,
    handleIfBanned: handleIfBanned,
    ADMIN_CONTACT_URL: ADMIN_CONTACT_URL
  };
})(window);
