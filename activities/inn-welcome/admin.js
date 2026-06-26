/**
 * 客栈迎新 - 管理员页逻辑
 * ======================
 * 依赖：
 *   - /api/activity/inn-welcome（游戏列表）
 *   - /api/inn-welcome/submissions（提交列表）
 *   - /api/inn-welcome/weights（读/设权重）
 *   - /api/inn-welcome/lottery（抽奖）
 */

let games = [];
let weights = {};
let adminToken = '';

document.addEventListener('DOMContentLoaded', init);

// Token 持久化（localStorage，避免每次输入；与排行榜管理页一致）
(function initToken() {
    const saved = localStorage.getItem('innAdminToken');
    if (saved) {
        adminToken = saved;
        // DOM 可能尚未就绪，DOMContentLoaded 之后回填
        document.addEventListener('DOMContentLoaded', () => {
            const el = document.getElementById('adminToken');
            if (el) el.value = saved;
        });
    }
})();

function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (adminToken) h['x-admin-token'] = adminToken;
    return h;
}

async function init() {
    await loadConfig();
    await loadWeights();
    await loadSubmissions();
    await loadLotteryResult();
    bindTokenInput();
}

function bindTokenInput() {
    const el = document.getElementById('adminToken');
    if (!el) return;
    el.addEventListener('change', () => {
        adminToken = el.value.trim();
        localStorage.setItem('innAdminToken', adminToken);
    });
}

async function loadConfig() {
    try {
        const res = await fetch('/api/activity/inn-welcome');
        const data = await res.json();
        if (data.success && data.activity) {
            games = data.activity.games || [];
            const def = data.activity.lottery && data.activity.lottery.defaultCount;
            if (def) document.getElementById('lotteryCount').value = def;
        }
    } catch (e) {
        showToast('加载活动配置失败');
    }
}

async function loadWeights() {
    try {
        const res = await fetch('/api/inn-welcome/weights');
        const data = await res.json();
        if (data.success) {
            weights = data.weights || {};
            if (games.length === 0 && data.games) games = data.games;
            renderWeights();
        }
    } catch (e) {
        showToast('加载权重失败');
    }
}

function renderWeights() {
    const box = document.getElementById('weightsBox');
    box.innerHTML = games.map(g => `
        <div class="weight-row">
            <span class="weight-name">${g.icon || ''} ${escapeHtml(g.name)}</span>
            <input type="number" class="weight-input" data-game="${g.id}" min="0" max="1" step="0.05" value="${weights[g.id] != null ? weights[g.id] : 0.2}">
        </div>
    `).join('');
}

async function computeWeights() {
    const inputs = document.querySelectorAll('.weight-input');
    const w = {};
    inputs.forEach(i => { w[i.dataset.game] = Number(i.value); });
    try {
        const res = await fetch('/api/inn-welcome/weights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(w)
        });
        const data = await res.json();
        if (data.success) {
            weights = data.weights || w;
            renderSubmissions(data.submissions || []);
            showToast('权重分计算完成');
        } else {
            showToast(data.error || '计算失败');
        }
    } catch (e) {
        showToast('网络错误');
    }
}

async function loadSubmissions() {
    try {
        const res = await fetch('/api/inn-welcome/submissions');
        const data = await res.json();
        if (data.success) renderSubmissions(data.submissions || []);
    } catch (e) {
        showToast('加载提交失败');
    }
}

function renderSubmissions(submissions) {
    document.getElementById('submissionCount').textContent = submissions.length;
    const head = document.getElementById('submissionsHead');
    const body = document.getElementById('submissionsBody');

    head.innerHTML = `<tr>
        <th>昵称</th><th>标签</th>
        ${games.map(g => `<th>${g.icon || ''} ${escapeHtml(g.name)}</th>`).join('')}
        <th>权重分</th><th>提交时间</th><th>操作</th>
    </tr>`;

    if (submissions.length === 0) {
        body.innerHTML = `<tr><td colspan="${games.length + 6}" class="no-record">暂无提交</td></tr>`;
        return;
    }

    body.innerHTML = submissions.map(s => {
        const scoreCells = games.map(g => {
            const sc = s.scores && s.scores[g.id];
            if (!sc || sc.score == null) return '<td class="no-record">—</td>';
            return `<td class="score-cell">${sc.score}<span class="unit">${escapeHtml(sc.unit || '')}</span></td>`;
        }).join('');
        const ws = s.weightScore != null ? s.weightScore : '—';
        const nick = escapeHtml(s.nickname);
        const nickAttr = escapeAttr(s.nickname);
        return `<tr>
            <td>${nick}</td>
            <td>${escapeHtml(s.tag)}</td>
            ${scoreCells}
            <td class="weight-score">${ws}</td>
            <td class="note-cell">${formatTime(s.submittedAt)}</td>
            <td class="ops-cell"><button class="danger-btn sm" onclick="deleteSubmission('${nickAttr}')">删除</button></td>
        </tr>`;
    }).join('');
}

async function deleteSubmission(nickname) {
    if (!nickname) { showToast('昵称为空'); return; }
    if (!confirm(`确认删除「${nickname}」的提交记录？此操作不可恢复。`)) return;
    try {
        const res = await fetch('/api/inn-welcome/submission?nickname=' + encodeURIComponent(nickname), {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            showToast(`已删除「${nickname}」的提交`);
            await loadSubmissions();
        } else {
            showToast(data.error || '删除失败');
        }
    } catch (e) {
        showToast('网络错误');
    }
}

async function runLottery() {
    const count = Number(document.getElementById('lotteryCount').value);
    if (!count || count < 1) { showToast('请输入有效的中奖人数'); return; }
    if (!confirm(`确定抽取 ${count} 名中奖者？将覆盖上次结果。`)) return;
    try {
        const res = await fetch('/api/inn-welcome/lottery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        });
        const data = await res.json();
        if (data.success) {
            renderLotteryResult(data);
            showToast(`抽奖完成，中奖 ${data.count} 人`);
        } else {
            showToast(data.error || '抽奖失败');
        }
    } catch (e) {
        showToast('网络错误');
    }
}

async function loadLotteryResult() {
    try {
        const res = await fetch('/api/inn-welcome/lottery/result');
        const data = await res.json();
        if (data.success && data.result) {
            renderLotteryResult(data.result);
        } else {
            document.getElementById('lotteryResult').style.display = 'block';
            document.getElementById('lotteryResult').innerHTML = '<p class="no-record">暂无抽奖结果</p>';
        }
    } catch (e) {
        showToast('加载抽奖结果失败');
    }
}

function renderLotteryResult(r) {
    const box = document.getElementById('lotteryResult');
    box.style.display = 'block';
    const winners = (r.winners || []).map((w, i) =>
        `<div class="winner-item"><span class="winner-rank">${i + 1}</span> ${escapeHtml(w.nickname)} <span class="winner-tag">${escapeHtml(w.tag)}</span> <span class="winner-ws">权重分 ${w.weightScore}</span></div>`
    ).join('');
    box.innerHTML = `
        <div class="winner-head">🏆 中奖名单（共 ${r.count} 人，抽奖时间 ${formatTime(r.drawnAt)}）</div>
        ${winners || '<p class="no-record">无</p>'}
    `;
}

function refreshAll() {
    init();
    showToast('已刷新');
}

function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function escapeHtml(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/'/g, "\\'");
}
