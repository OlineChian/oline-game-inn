/**
 * 公告弹窗模块（客户端公共模块）
 *
 * 功能：
 *   - 页面加载时自动检查未读公告
 *   - 迎新公告：首次访问的玩家展示一次（localStorage 标记）
 *     新玩家看完迎新公告后会立即展示最新未读公告（链式展示）
 *   - 普通公告：每条对每个用户只展示一次（按公告 ID 记录已读）
 *   - 公告内容支持轻量 Markdown 渲染
 *   - 不同类型公告配色不同（info/event/update/urgent/welcome）
 *
 * Markdown 语法：
 *   # 标题1   ## 标题2   ### 标题3
 *   **粗体**   *斜体*   `行内代码`
 *   - 无序列表   1. 有序列表
 *   > 引用块
 *   ---  分隔线
 *   [链接文字](https://example.com)
 *   {{red 红色文字}} 或 {{#ff0000 自定义颜色}}
 *
 * 用法（在页面 HTML 中引入）：
 *   <script src="/notice.js"></script>
 */
(function (global) {
  'use strict';

  var READ_KEY = 'notice:read';
  var WELCOMED_KEY = 'notice:welcomed';
  var modalEl = null;
  var styleInjected = false;

  // 公告类型配色（与主题色协调，降级值适配深色主题）
  var TYPE_COLORS = {
    info:   { accent: '#ED7526', label: '公告' },
    event:  { accent: '#F8C93F', label: '活动' },
    update: { accent: '#00b894', label: '更新' },
    urgent: { accent: '#ff6b6b', label: '紧急' },
    welcome:{ accent: '#a78bfa', label: '迎新' }
  };

  // 颜色名映射（用于 {{red 文字}} 简写语法）
  var COLOR_NAMES = {
    red: '#ff6b6b', orange: '#ED7526', yellow: '#F8C93F', gold: '#F8C93F',
    green: '#00b894', blue: '#74b9ff', cyan: '#67e8f9',
    purple: '#a78bfa', pink: '#ff85c8', gray: '#8a9099', grey: '#8a9099',
    white: '#ffffff', black: '#1f2329'
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
'.notice-content{font-size:14px;line-height:1.8;word-break:break-word;color:var(--text-primary,rgba(255,255,255,.9))}' +
'.notice-content p{margin:0 0 10px}' +
'.notice-content p:last-child{margin-bottom:0}' +
'.notice-content h1{font-size:20px;font-weight:700;margin:14px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--bg-card-alt,#1a1a1a)}' +
'.notice-content h2{font-size:17px;font-weight:700;margin:12px 0 8px}' +
'.notice-content h3{font-size:15px;font-weight:600;margin:10px 0 6px}' +
'.notice-content ul,.notice-content ol{margin:6px 0 10px;padding-left:22px}' +
'.notice-content li{margin:3px 0}' +
'.notice-content blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--bg-card-alt,#333);background:rgba(255,255,255,.03);color:var(--text-secondary,rgba(255,255,255,.7));font-style:italic}' +
'.notice-content blockquote br{display:none}' +
'.notice-content blockquote p{margin:4px 0}' +
'.notice-content code{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:3px;font-family:Consolas,Monaco,monospace;font-size:13px}' +
'.notice-content hr{border:none;border-top:1px solid var(--bg-card-alt,#1a1a1a);margin:14px 0}' +
'.notice-content a{color:var(--accent,#ED7526);text-decoration:underline}' +
'.notice-content a:hover{opacity:.85}' +
'.notice-content strong{font-weight:700;color:#fff}' +
'.notice-content em{font-style:italic}' +
'.notice-signature{text-align:right;margin-top:16px;font-size:13px;color:var(--text-secondary,rgba(255,255,255,.65));font-style:italic}' +
'.notice-footer{padding:14px 24px;border-top:1px solid var(--bg-card-alt,#1a1a1a);display:flex;justify-content:flex-end;gap:12px}' +
'.notice-btn{padding:9px 22px;border:none;border-radius:var(--radius-sm,6px);font-size:14px;cursor:pointer;transition:opacity .15s;font-family:inherit}' +
'.notice-btn-primary{background:var(--accent,#ED7526);color:#fff}' +
'.notice-btn-primary:hover{opacity:.85}' +
'.notice-btn-secondary{background:transparent;color:var(--text-secondary,rgba(255,255,255,.65));border:1px solid var(--bg-card-alt,#333)}' +
'.notice-btn-secondary:hover{background:rgba(255,255,255,.05)}' +
'.notice-icon{flex-shrink:0}' +
'.notice-date{font-size:12px;color:var(--text-secondary,rgba(255,255,255,.55));font-weight:400;margin-left:8px}' +
'.notice-merged-body{padding:8px 24px;max-height:60vh;overflow-y:auto}' +
'.notice-card{padding:18px 0;border-bottom:1px solid var(--bg-card-alt,#1a1a1a)}' +
'.notice-card:first-child{padding-top:6px}' +
'.notice-card:last-child{border-bottom:none}' +
'.notice-card-header{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}' +
'.notice-card-title{font-size:15px;font-weight:700;flex:1;line-height:1.4}' +
'.notice-card-date{font-size:11px;color:var(--text-secondary,rgba(255,255,255,.5));white-space:nowrap}' +
'.notice-card-content{font-size:14px;line-height:1.8;word-break:break-word;color:var(--text-primary,rgba(255,255,255,.9))}' +
'.notice-card-content p{margin:0 0 8px}' +
'.notice-card-content p:last-child{margin-bottom:0}' +
'.notice-card-content h1{font-size:18px;font-weight:700;margin:10px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--bg-card-alt,#1a1a1a)}' +
'.notice-card-content h2{font-size:16px;font-weight:700;margin:10px 0 6px}' +
'.notice-card-content h3{font-size:14px;font-weight:600;margin:8px 0 4px}' +
'.notice-card-content ul,.notice-card-content ol{margin:4px 0 8px;padding-left:20px}' +
'.notice-card-content li{margin:2px 0}' +
'.notice-card-content blockquote{margin:6px 0;padding:4px 10px;border-left:3px solid var(--bg-card-alt,#333);background:rgba(255,255,255,.03);color:var(--text-secondary,rgba(255,255,255,.7));font-style:italic}' +
'.notice-card-content code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-family:Consolas,Monaco,monospace;font-size:12px}' +
'.notice-card-content hr{border:none;border-top:1px solid var(--bg-card-alt,#1a1a1a);margin:10px 0}' +
'.notice-card-content a{color:var(--accent,#ED7526);text-decoration:underline}' +
'.notice-card-content strong{font-weight:700;color:#fff}' +
'.notice-card-signature{text-align:right;margin-top:10px;font-size:12px;color:var(--text-secondary,rgba(255,255,255,.6));font-style:italic}' +
'.notice-load-more{display:block;margin:14px auto 4px;padding:8px 24px;border:1px dashed var(--bg-card-alt,#333);border-radius:6px;background:transparent;color:var(--text-secondary,rgba(255,255,255,.7));font-size:13px;cursor:pointer;transition:background .15s;font-family:inherit}' +
'.notice-load-more:hover{background:rgba(255,255,255,.05);color:var(--text-primary,rgba(255,255,255,.9))}' +
'.notice-merged-summary{text-align:center;font-size:12px;color:var(--text-secondary,rgba(255,255,255,.55));margin:0 0 8px}' +
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

  // 格式化发布日期：仅展示年-月-日
  function formatDate(ts) {
    var n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '';
    var d = new Date(n);
    if (isNaN(d.getTime())) return '';
    var pad = function (x) { return x < 10 ? '0' + x : String(x); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 校验颜色值：只允许 #hex 或字母（防止样式注入）
  function safeColor(c) {
    if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
    if (/^[a-zA-Z]+$/.test(c) && COLOR_NAMES[c.toLowerCase()]) return COLOR_NAMES[c.toLowerCase()];
    if (/^[a-zA-Z]+$/.test(c)) return c; // CSS 颜色名如 red/blue
    return 'inherit';
  }

  // 行内 Markdown 渲染：粗体、斜体、行内代码、链接、颜色
  function renderInline(text) {
    if (!text) return '';
    // 颜色：{{red 文字}} 或 {{#ff0000 文字}}
    text = text.replace(/\{\{(#?[a-zA-Z0-9]+)\s+([^}]+)\}\}/g, function (m, color, content) {
      return '<span style="color:' + safeColor(color) + '">' + content + '</span>';
    });
    // 链接：[text](url)  url 限制为 http(s)/mailto，防 XSS
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, function (m, txt, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>';
    });
    // 行内代码：`code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 粗体：**text**  （先于斜体处理，避免冲突）
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜体：*text*  （前后不能是 *，避免与粗体冲突）
    text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    return text;
  }

  // 块级 Markdown 渲染：标题、列表、引用、分隔线、段落
  function renderMarkdown(text) {
    if (!text) return '';
    var lines = escapeHtml(text).split('\n');
    var html = '';
    var inUl = false, inOl = false, inQuote = false;
    var paragraph = [];

    function flushParagraph() {
      if (paragraph.length > 0) {
        html += '<p>' + paragraph.join('<br>') + '</p>';
        paragraph = [];
      }
    }
    function closeLists() {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
    }
    function closeQuote() {
      if (inQuote) { html += '</blockquote>'; inQuote = false; }
    }
    function closeAll() { flushParagraph(); closeLists(); closeQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      // 空行：结束当前块
      if (!trimmed) { closeAll(); continue; }

      // 标题
      var hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (hMatch) {
        closeAll();
        var level = hMatch[1].length;
        html += '<h' + level + '>' + renderInline(hMatch[2]) + '</h' + level + '>';
        continue;
      }

      // 分隔线（--- 或 ***）
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        closeAll();
        html += '<hr>';
        continue;
      }

      // 引用：> 文本（escapeHtml 后 &gt; 代表 >）
      var qMatch = trimmed.match(/^&gt;\s?(.*)$/);
      if (qMatch) {
        flushParagraph();
        closeLists();
        if (!inQuote) { html += '<blockquote>'; inQuote = true; }
        html += '<p>' + renderInline(qMatch[1]) + '</p>';
        continue;
      }

      // 无序列表：- 或 * 开头
      var ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        flushParagraph();
        closeQuote();
        if (inOl) { html += '</ol>'; inOl = false; }
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += '<li>' + renderInline(ulMatch[1]) + '</li>';
        continue;
      }

      // 有序列表：1. 开头
      var olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        flushParagraph();
        closeQuote();
        if (inUl) { html += '</ul>'; inUl = false; }
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += '<li>' + renderInline(olMatch[1]) + '</li>';
        continue;
      }

      // 普通段落
      closeLists();
      closeQuote();
      paragraph.push(renderInline(trimmed));
    }

    closeAll();
    return html;
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

  // 展示单条公告弹窗（迎新公告专用）。onClose 关闭后的回调（用于链式展示）
  function showModal(notice, isWelcome, onClose) {
    injectStyle();
    closeModal();
    var type = notice.type || 'info';
    var colors = TYPE_COLORS[type] || TYPE_COLORS.info;
    var title = notice.title || '公告';
    var content = notice.content || '';
    var signature = notice.signature || '';
    var dateStr = formatDate(notice.createdAt);

    modalEl = document.createElement('div');
    modalEl.className = 'notice-overlay';
    modalEl.style.setProperty('--accent', colors.accent);
    modalEl.innerHTML =
      '<div class="notice-box">' +
        '<div class="notice-header">' +
          typeIcon(colors.accent) +
          '<span class="notice-badge" style="background:' + colors.accent + '">' + escapeHtml(colors.label) + '</span>' +
          '<div class="notice-title">' + escapeHtml(title) +
            (dateStr ? '<span class="notice-date">' + escapeHtml(dateStr) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="notice-body">' +
          '<div class="notice-content">' + renderMarkdown(content) + '</div>' +
          (signature ? '<div class="notice-signature">— ' + escapeHtml(signature) + ' —</div>' : '') +
        '</div>' +
        '<div class="notice-footer">' +
          '<button class="notice-btn notice-btn-secondary" type="button">关闭</button>' +
          '<button class="notice-btn notice-btn-primary" type="button">' + (isWelcome ? '开始游戏' : '我知道了') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);

    var handleClose = function () {
      closeModal();
      if (typeof onClose === 'function') {
        try { onClose(); } catch (e) { if (global.console && console.debug) console.debug('[notice] onClose error:', e); }
      }
    };
    var closeBtn = modalEl.querySelector('.notice-btn-secondary');
    var okBtn = modalEl.querySelector('.notice-btn-primary');
    if (closeBtn) closeBtn.onclick = handleClose;
    if (okBtn) okBtn.onclick = handleClose;
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) handleClose();
    });
  }

  /**
   * 合并展示多条公告（除迎新外的普通公告）
   * - 初始渲染前 3 条未读公告
   * - "查看更多"按钮每次追加 3 条
   * - 关闭时将所有已展示公告标记为已读
   * @param {Array} notices - 全部未读公告（已按 createdAt 倒序）
   * @param {Function} [onClose] - 关闭回调
   */
  function showMergedModal(notices, onClose) {
    injectStyle();
    closeModal();
    if (!notices || notices.length === 0) {
      if (typeof onClose === 'function') onClose();
      return;
    }
    var PAGE_SIZE = 3;
    var shown = []; // 已渲染的公告（关闭时统一标记已读）
    var cursor = 0;

    modalEl = document.createElement('div');
    modalEl.className = 'notice-overlay';
    modalEl.style.setProperty('--accent', TYPE_COLORS.info.accent);
    modalEl.innerHTML =
      '<div class="notice-box">' +
        '<div class="notice-header">' +
          typeIcon(TYPE_COLORS.info.accent) +
          '<span class="notice-badge" style="background:' + TYPE_COLORS.info.accent + '">公告</span>' +
          '<div class="notice-title">你有 ' + notices.length + ' 条未读公告</div>' +
        '</div>' +
        '<div class="notice-merged-body" id="notice-merged-body"></div>' +
        '<div class="notice-footer">' +
          '<button class="notice-btn notice-btn-secondary" type="button">关闭</button>' +
          '<button class="notice-btn notice-btn-primary" type="button">我已知晓</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);

    var bodyEl = modalEl.querySelector('#notice-merged-body');

    function renderCard(notice) {
      var type = notice.type || 'info';
      var colors = TYPE_COLORS[type] || TYPE_COLORS.info;
      var dateStr = formatDate(notice.createdAt);
      var card = document.createElement('div');
      card.className = 'notice-card';
      card.style.setProperty('--accent', colors.accent);
      card.innerHTML =
        '<div class="notice-card-header">' +
          '<span class="notice-badge" style="background:' + colors.accent + '">' + escapeHtml(colors.label) + '</span>' +
          '<div class="notice-card-title">' + escapeHtml(notice.title || '公告') + '</div>' +
          (dateStr ? '<div class="notice-card-date">' + escapeHtml(dateStr) + '</div>' : '') +
        '</div>' +
        '<div class="notice-card-content">' + renderMarkdown(notice.content || '') + '</div>' +
        (notice.signature ? '<div class="notice-card-signature">— ' + escapeHtml(notice.signature) + ' —</div>' : '');
      return card;
    }

    function renderLoadMore() {
      var remaining = notices.length - cursor;
      if (remaining <= 0) return null;
      var btn = document.createElement('button');
      btn.className = 'notice-load-more';
      btn.type = 'button';
      btn.textContent = '查看更多（还有 ' + remaining + ' 条未读）';
      btn.onclick = function () {
        btn.remove();
        renderNextPage();
      };
      return btn;
    }

    function renderNextPage() {
      var end = Math.min(cursor + PAGE_SIZE, notices.length);
      for (var i = cursor; i < end; i++) {
        bodyEl.appendChild(renderCard(notices[i]));
        shown.push(notices[i]);
      }
      cursor = end;
      var more = renderLoadMore();
      if (more) bodyEl.appendChild(more);
      // 自动滚动到底部新加载的位置
      setTimeout(function () {
        var last = bodyEl.lastElementChild;
        if (last && last.classList.contains('notice-load-more')) {
          last.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 50);
    }

    renderNextPage();

    var handleClose = function () {
      // 关闭时将所有已展示公告标记为已读
      shown.forEach(function (n) { markRead(n.id); });
      closeModal();
      if (typeof onClose === 'function') {
        try { onClose(); } catch (e) { if (global.console && console.debug) console.debug('[notice] onClose error:', e); }
      }
    };
    var closeBtn = modalEl.querySelector('.notice-btn-secondary');
    var okBtn = modalEl.querySelector('.notice-btn-primary');
    if (closeBtn) closeBtn.onclick = handleClose;
    if (okBtn) okBtn.onclick = handleClose;
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) handleClose();
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
  // 迎新公告：首次访问单独弹窗，关闭后接合并展示未读普通公告
  // 普通公告：合并展示，每次渲染 3 条，"查看更多"按钮继续加载
  function checkAndShow() {
    fetch('/api/notice/active')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) return;
        var welcome = data.welcome;
        var notices = data.notices || [];
        var readList = getReadList();

        // 收集所有未读普通公告（已按 createdAt 倒序）
        var unread = notices.filter(function (n) {
          return readList.indexOf(n.id) < 0;
        });

        // 优先：迎新公告（仅首次访问展示）
        if (welcome && !hasBeenWelcomed()) {
          markWelcomed();
          // 迎新关闭后接合并展示未读普通公告
          showModal(welcome, true, function () {
            if (unread.length > 0) showMergedModal(unread);
          });
          return;
        }
        markWelcomed(); // 即使无迎新公告也标记，避免每次检查

        // 普通公告：合并展示所有未读
        if (unread.length > 0) {
          showMergedModal(unread);
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
    showMergedModal: showMergedModal,
    closeModal: closeModal,
    // 暴露 Markdown 渲染器供管理员页面预览使用
    renderMarkdown: renderMarkdown
  };

  // 自动执行：页面加载完成后检查（管理页面可通过 NOTICE_DISABLE_AUTO 禁用）
  if (global.NOTICE_DISABLE_AUTO === true) {
    // 管理页面只使用渲染器，不自动弹公告
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShow);
  } else {
    setTimeout(checkAndShow, 300);
  }
})(window);
