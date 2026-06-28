/**
 * 失败提交管理（securityoline.html Tab 5 专用）
 *
 * 职责：
 *   1. 加载 /api/security/failed-submissions 列表
 *   2. 渲染表格（时间/游戏/昵称/分数/IP/失败原因/类别/状态/操作）
 *   3. 管理员重新上传（绕过签名与反作弊校验，直接调用 service.submitScore）
 *   4. 删除单条记录
 *
 * 依赖：securityoline.html 提供的全局函数 authHeaders() / showStatus() / fmtTime() / escapeHtml() / escapeAttr()
 */
(function (global) {
  'use strict';

  var CATEGORY_LABELS = {
    signature: '签名失败',
    security: '反作弊拦截',
    service: '业务错误',
    unknown: '其他'
  };

  var CATEGORY_BADGES = {
    signature: 'badge-warn',
    security: 'badge-ban',
    service: 'badge-purge',
    unknown: 'badge-expired'
  };

  var state = {
    filter: '',
    hideUploaded: false,
    lastList: []
  };

  function buildQuery() {
    var q = [];
    if (state.filter) q.push('category=' + encodeURIComponent(state.filter));
    if (state.hideUploaded) q.push('uploaded=false');
    return q.length ? '?' + q.join('&') : '';
  }

  function render(list) {
    var body = document.getElementById('failedBody');
    var summary = document.getElementById('failedSummary');
    if (!body || !summary) return;
    if (!list || list.length === 0) {
      body.innerHTML = '<tr><td colspan="9" class="empty">暂无失败提交记录</td></tr>';
      summary.textContent = '共 0 条记录';
      return;
    }
    var uploaded = list.filter(function (r) { return r.uploaded; }).length;
    summary.textContent = '共 ' + list.length + ' 条（未上传 ' + (list.length - uploaded) + ' / 已上传 ' + uploaded + '）';
    var html = '';
    list.forEach(function (r) {
      var cat = r.category || 'unknown';
      var catLabel = CATEGORY_LABELS[cat] || cat;
      var catBadge = CATEGORY_BADGES[cat] || 'badge-expired';
      var statusBadge = r.uploaded
        ? '<span class="badge badge-expired">已重新上传</span>'
        : '<span class="badge badge-warn">待处理</span>';
      var actions = r.uploaded
        ? '<button class="sm danger" onclick="SecurityFailed.del(\'' + escapeAttr(r.id) + '\')">删除</button>'
        : '<button class="sm primary" onclick="SecurityFailed.retry(\'' + escapeAttr(r.id) + '\')">重新上传</button> ' +
          '<button class="sm danger" onclick="SecurityFailed.del(\'' + escapeAttr(r.id) + '\')">删除</button>';
      html +=
        '<tr' + (r.uploaded ? ' class="expired"' : '') + '>' +
        '<td class="time-cell">' + fmtTime(r.at) + '</td>' +
        '<td>' + escapeHtml(r.gameId || '-') + '</td>' +
        '<td>' + escapeHtml(r.nickname || '-') + '</td>' +
        '<td>' + escapeHtml(r.score != null ? r.score : '-') + '</td>' +
        '<td class="ip-cell">' + escapeHtml(r.ip || '-') + '</td>' +
        '<td class="reason-cell">' + escapeHtml(r.error || '-') + '</td>' +
        '<td><span class="badge ' + catBadge + '">' + escapeHtml(catLabel) + '</span></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    });
    body.innerHTML = html;
  }

  function load() {
    var body = document.getElementById('failedBody');
    if (body) body.innerHTML = '<tr><td colspan="9" class="empty">加载中...</td></tr>';
    fetch('/api/security/failed-submissions' + buildQuery(), { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) { showStatus(data.error || '加载失败', false); return; }
        state.lastList = data.failed || [];
        render(state.lastList);
      })
      .catch(function (err) { showStatus('加载失败: ' + err.message, false); });
  }

  function retry(id) {
    if (!id) return;
    // 找出当前记录用于二次确认（避免误操作）
    var rec = (state.lastList || []).find(function (r) { return r.id === id; });
    var label = rec
      ? (rec.nickname || '?') + ' / ' + (rec.gameId || '?') + ' / ' + (rec.score != null ? rec.score : '?') + ' 分'
      : '该记录';
    if (!confirm('确认重新上传该成绩？\n\n' + label + '\n\n将绕过签名与反作弊校验，直接写入排行榜。')) return;
    fetch('/api/security/failed-submissions/' + encodeURIComponent(id) + '/retry', {
      method: 'POST', headers: authHeaders()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          showStatus('已重新上传成绩' + (data.result && data.result.rank ? '，排名 #' + data.result.rank : ''), true);
          load();
        } else {
          showStatus(data.error || '重新上传失败', false);
        }
      })
      .catch(function (err) { showStatus('重新上传失败: ' + err.message, false); });
  }

  function del(id) {
    if (!id) return;
    if (!confirm('确认删除该失败提交记录？此操作不可撤销。')) return;
    fetch('/api/security/failed-submissions/' + encodeURIComponent(id), {
      method: 'DELETE', headers: authHeaders()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) { showStatus('已删除记录', true); load(); }
        else showStatus(data.error || '删除失败', false);
      })
      .catch(function (err) { showStatus('删除失败: ' + err.message, false); });
  }

  function setFilter(val) { state.filter = val || ''; load(); }
  function setHideUploaded(val) { state.hideUploaded = !!val; load(); }

  global.SecurityFailed = {
    load: load,
    retry: retry,
    del: del,
    setFilter: setFilter,
    setHideUploaded: setHideUploaded
  };
})(window);
