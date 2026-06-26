/**
 * 封禁提示弹窗（客户端公共模块）
 *
 * 当服务端 POST /api/leaderboard/:game 返回 403（IP 被封禁）时，
 * 各游戏客户端调用 BanNotice.show(data) 弹出友好提示，
 * 避免玩家误以为成绩提交失败是 bug。
 *
 * 弹窗含「联系管理员」按钮，链接与首页"提交反馈"一致。
 *
 * 用法：
 *   // 方式 A：游戏已解析 JSON
 *   if (response.status === 403) {
 *     if (window.BanNotice) window.BanNotice.show(data);
 *     return;
 *   }
 *
 *   // 方式 B：游戏未解析 JSON（自动解析）
 *   if (window.BanNotice && await window.BanNotice.handleIfBanned(response)) return;
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
    // CSS 变量降级（theme 未加载时用 fallback）
    style.textContent =
'.ban-notice-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100000;animation:ban-fade .25s ease}' +
'.ban-notice-box{background:var(--bg-surface,#fff);color:var(--text-primary,#333);padding:28px 32px;border-radius:12px;max-width:92vw;width:420px;box-shadow:0 12px 40px rgba(0,0,0,.4);text-align:center;font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box}' +
'.ban-notice-icon{font-size:42px;line-height:1;margin-bottom:12px}' +
'.ban-notice-title{font-size:18px;font-weight:700;color:var(--color-danger,#d32f2f);margin-bottom:12px}' +
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
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatDate(ts) {
    var n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '-';
    var d = new Date(n);
    if (isNaN(d.getTime())) return '-';
    // YYYY-MM-DD HH:mm:ss（本地时区）
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function showModal(data) {
    injectStyle();
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div');
    modalEl.className = 'ban-notice-overlay';

    var reason = (data && (data.banReason || data.error)) || '检测到不正当游戏行为';
    var until = (data && data.banUntil) ? formatDate(data.banUntil) : '-';
    var nickname = data && data.nickname ? data.nickname : '';

    var metaHtml =
      '<div class="ban-notice-meta">' +
      (nickname ? '<div><strong>昵称：</strong>' + escapeHtml(nickname) + '</div>' : '') +
      '<div><strong>封禁原因：</strong>' + escapeHtml(reason) + '</div>' +
      '<div><strong>解禁时间：</strong>' + escapeHtml(until) + '</div>' +
      '</div>';

    modalEl.innerHTML =
      '<div class="ban-notice-box">' +
      '<div class="ban-notice-icon">⚠️</div>' +
      '<div class="ban-notice-title">账号暂时无法提交成绩</div>' +
      '<div class="ban-notice-msg">系统可能检测到不正当游戏行为，这不是你的错。如需解禁请联系管理员。</div>' +
      metaHtml +
      '<div class="ban-notice-actions">' +
      '<a class="ban-notice-btn ban-notice-btn-primary" href="' + ADMIN_CONTACT_URL + '" target="_blank" rel="noopener">联系管理员</a>' +
      '<button class="ban-notice-btn ban-notice-btn-secondary" type="button">关闭</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(modalEl);

    var closeBtn = modalEl.querySelector('.ban-notice-btn-secondary');
    if (closeBtn) {
      closeBtn.onclick = function () {
        modalEl.remove();
        modalEl = null;
      };
    }
  }

  /**
   * 显示封禁提示弹窗
   * @param {object} [data] - 服务端 403 响应体 { banned, banReason, banUntil, nickname, error }
   */
  function show(data) {
    showModal(data || {});
  }

  /**
   * 检测 HTTP 响应是否为封禁 403，若是则弹窗并返回 true
   * 用于不解析响应体的游戏客户端（rosa-ember / tara）
   * @param {Response} response - fetch 返回的 Response 对象
   * @returns {Promise<boolean>} true 表示已弹窗（应中止后续逻辑），false 表示非封禁
   */
  async function handleIfBanned(response) {
    if (!response || response.status !== 403) return false;
    var data;
    try {
      data = await response.clone().json();
    } catch (_) {
      try {
        var txt = await response.clone().text();
        data = { error: String(txt) };
      } catch (e2) {
        data = {};
      }
    }
    // 仅当响应明确标记 banned=true 或 error 文本含"封禁"时弹窗
    if (data && (data.banned === true ||
        (typeof data.error === 'string' && data.error.indexOf('封禁') >= 0))) {
      show(data);
      return true;
    }
    return false;
  }

  global.BanNotice = {
    show: show,
    handleIfBanned: handleIfBanned,
    ADMIN_CONTACT_URL: ADMIN_CONTACT_URL
  };
})(window);
