/**
 * 公告弹窗模块（客户端公共模块）
 *
 * 功能：
 *   - 页面加载时自动检查未读公告
 *   - 迎新公告：首次访问的玩家展示一次（localStorage 标记）
 *   - 普通公告：每条对每个用户只展示一次（按公告 ID 记录已读）
 *   - 不同类型公告配色不同（info/event/update/urgent/welcome）
 *
 * 用法（在页面 HTML 中引入）：
 *   <script src="/notice.js"></script>
 *   页面加载后自动执行 checkAndShow()，无需手动调用
 *
 * 依赖：无（纯 vanilla JS，CSS 变量降级兼容）
 */
(function (global) {
  'use strict';

  var READ_KEY = 'notice:read';
  var WELCOMED_KEY = 'notice:welcomed';
  var modalEl = null;
  var styleInjected = false;

  // 公告类型配色（与主题色协调，降级值适配深色主题）
  var TYPE_COLORS = {
    info:   { accent: '#ED7526', label: '公告' },       // 主题橙
    event:  { accent: '#F8C93F', label: '活动' },        // 金色
    update: { accent: '#00b894', label: '更新' },        // 绿色
    urgent: { accent: '#ff6b6b', label: '紧急' },       // 红色
    welcome:{ accent: '#a78bfa', label: '迎新' }         // 紫色
  };

  function injectStyle() {
    if (styleInjected) return;
    var style = document.createElement('style');
    style.id = 'notice-popup-style';
    style.textContent =
'.notice-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100001;animation:notice-fade .25s ease}' +
'.notice-box{background:var(--bg-card,#111);color:var(--text-primary,rgba(255,255,255,.9));padding:0;border-radius:var(--radius-lg,14px);max-width:92vw;width:480px;box-shadow:var(--shadow-modal,0 20px 60px rgba(0,0,0,.6));overflow:hidden;font-family:system-ui,-apple-system,sans-serif;animation:notice-slide .3s ease}' +
'.notice-header{padding:20px 24px 16px;border-bottom:1px solid var(--bg-card-alt,#1a1a1a);display:flex;align-items:center;gap:12px}' +
'.notice-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:var(--radius-sm,6px);font-size:12px;font-weight:600;color:#fff}' +
'.notice-title{font-size:17px;font-weight:700;flex:1;line-height:1.4}' +
'.notice-body{padding:20px 24px;max-height:50vh;overflow-y:auto}' +
'.notice-content{font-size:14px;line-height:1.8;white-space:pre-wrap;word-break:break-word;color:var(--text-primary,rgba(255,255,255,.9))}' +
'.notice-signature{text-align:right;margin-top:16px;font-size:13px;color:var(--text-secondary,rgba(255,255,255,.65));font-style:italic}' +
'.notice-footer{padding:14px 24px;border-top:1px solid var(--bg-card-alt,#1a1a1a);display:flex;justify-content:flex-end;gap:12px}' +
'.notice-btn{padding:9px 22px;border:none;border-radius:var(--radius-sm,6px);font-size:14px;cursor:pointer;transition:opacity .15s;font-family:inherit}' +
'.notice-btn-primary{background:var(--accent,#ED7526);color:#fff}' +
'.notice-btn-primary:hover{opacity:.85}' +
'.notice-btn-secondary{background:transparent;color:var(--text-secondary,rgba(255,255,255,.65));border:1px solid var(--bg-card-alt,#333)}' +
'.notice-btn-secondary:hover{background:rgba(255,255,255,.05)}' +
'.notice-icon{flex-shrink:0}' +
'@keyframes notice-fade{from{opacity:0}to{opacity:1}}' +
'@keyframes notice-slide{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);
    styleInjected = true;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  // SVG 图标（喇叭/通知样式），颜色参数化
  function typeIcon(color) {
    return '<svg class="notice-icon" width="28" height="28" viewBox="0 0 24 24" fill="none">' +
      '<path d="M3 10v4c0 1 .8 2 2 2h2l4 4V4L7 8H5c-1 0-2 1-2 2z" fill="' + color + '" opacity=".2"/>' +
      '<path d="M3 10v4c0 1 .8 2 2 2h2l4 4V4L7 8H5c-1 0-2 1-2 2z" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" fill="none"/>' +
      '<path d="M16 8c1.5 1 2.5 2.5 2.5 4s-1 3-2.5 4" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
      '<path d="M18.5 5.5c2.5 1.8 4 4 4 6.5s-1.5 4.7-4 6.5" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  }

  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function showModal(notice, isWelcome) {
    injectStyle();
    closeModal();
    var type = notice.type || 'info';
    var colors = TYPE_COLORS[type] || TYPE_COLORS.info;
    var title = notice.title || '公告';
    var content = notice.content || '';
    var signature = notice.signature || '';

    modalEl = document.createElement('div');
    modalEl.className = 'notice-overlay';
    modalEl.style.setProperty('--accent', colors.accent);
    modalEl.innerHTML =
      '<div class="notice-box">' +
        '<div class="notice-header">' +
          typeIcon(colors.accent) +
          '<span class="notice-badge" style="background:' + colors.accent + '">' + escapeHtml(colors.label) + '</span>' +
          '<div class="notice-title">' + escapeHtml(title) + '</div>' +
        '</div>' +
        '<div class="notice-body">' +
          '<div class="notice-content">' + escapeHtml(content) + '</div>' +
          (signature ? '<div class="notice-signature">— ' + escapeHtml(signature) + ' —</div>' : '') +
        '</div>' +
        '<div class="notice-footer">' +
          '<button class="notice-btn notice-btn-secondary" type="button">关闭</button>' +
          '<button class="notice-btn notice-btn-primary" type="button">' + (isWelcome ? '开始游戏' : '我知道了') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);

    var closeBtn = modalEl.querySelector('.notice-btn-secondary');
    var okBtn = modalEl.querySelector('.notice-btn-primary');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (okBtn) okBtn.onclick = closeModal;
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) closeModal();
    });
  }

  // ===== localStorage 已读管理 =====
  function getReadList() {
    try {
      var arr = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function markRead(id) {
    var arr = getReadList();
    if (arr.indexOf(id) < 0) {
      arr.push(id);
      try { localStorage.setItem(READ_KEY, JSON.stringify(arr)); } catch (_) {}
    }
  }

  function hasBeenWelcomed() {
    try { return localStorage.getItem(WELCOMED_KEY) === '1'; } catch (_) { return false; }
  }

  function markWelcomed() {
    try { localStorage.setItem(WELCOMED_KEY, '1'); } catch (_) {}
  }

  // ===== 主入口：检查并展示公告 =====
  function checkAndShow() {
    fetch('/api/notice/active')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) return;
        var welcome = data.welcome;
        var notices = data.notices || [];

        // 优先：迎新公告（仅首次访问展示）
        if (welcome && !hasBeenWelcomed()) {
          markWelcomed();
          showModal(welcome, true);
          return;
        }
        markWelcomed(); // 即使无迎新公告也标记，避免每次检查

        // 普通公告：展示最新一条未读
        var readList = getReadList();
        for (var i = 0; i < notices.length; i++) {
          var n = notices[i];
          if (readList.indexOf(n.id) < 0) {
            markRead(n.id);
            showModal(n, false);
            return;
          }
        }
      })
      .catch(function (e) {
        // 静默失败：公告系统不应影响游戏体验
        if (global.console && console.debug) console.debug('[notice] check failed:', e);
      });
  }

  global.Notice = {
    checkAndShow: checkAndShow,
    showModal: showModal,
    closeModal: closeModal
  };

  // 自动执行：页面加载完成后检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShow);
  } else {
    setTimeout(checkAndShow, 300);
  }
})(window);
