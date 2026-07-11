/**
 * 巅峰双重挑战 - 管理员页面逻辑
 */

let adminToken = '';

(function initToken() {
    const saved = localStorage.getItem('peakDualAdminToken');
    if (saved) {
        adminToken = saved;
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

document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('adminToken');
    if (el) el.addEventListener('change', () => {
        adminToken = el.value.trim();
        localStorage.setItem('peakDualAdminToken', adminToken);
    });
    refreshAll();
});

async function refreshAll() {
    await loadStatus();
    await loadConfig();
    await loadWinners();
    await loadPlayers();
    await loadLogs();
}

async function loadStatus() {
    try {
        const res = await fetch('/api/peak-dual/status');
        const data = await res.json();
        if (data.success) {
            document.getElementById('remainPrize').textContent = data.config.remainPrize + ' / ' + data.config.totalPrize;
            document.getElementById('drawCount').textContent = data.config.currentDrawCount + ' / ' + data.config.totalGuaranteedDraw;
            document.getElementById('totalPlayers').textContent = data.totalPlayers;
            document.getElementById('totalWinners').textContent = data.totalWinners;
        }
    } catch (e) { showToast('加载状态失败'); }
}

async function loadConfig() {
    try {
        const res = await fetch('/api/peak-dual/admin/config', { headers: authHeaders() });
        const data = await res.json();
        if (data.success && data.config) {
            document.getElementById('cfgTotalPrize').value = data.config.totalPrize;
            document.getElementById('cfgGuaranteedDraw').value = data.config.totalGuaranteedDraw;
            document.getElementById('cfgMaxDraws').value = data.config.maxDrawsPerPlayer;
        }
    } catch (e) { showToast('加载配置失败'); }
}

async function saveConfig() {
    const payload = {
        totalPrize: Number(document.getElementById('cfgTotalPrize').value),
        totalGuaranteedDraw: Number(document.getElementById('cfgGuaranteedDraw').value),
        maxDrawsPerPlayer: Number(document.getElementById('cfgMaxDraws').value)
    };
    try {
        const res = await fetch('/api/peak-dual/admin/config', {
            method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast('配置已保存，系统已重算');
            await refreshAll();
        } else { showToast(data.error || '保存失败'); }
    } catch (e) { showToast('网络错误'); }
}

async function initializeSystem() {
    if (!confirm('确认执行活动初始化？\n\n已中奖玩家：保留全部数据，永久不可再参与\n未中奖玩家：保留抽奖次数和保底进度，重置成绩\n配置：抽奖总计数归零，剩余奖品重算')) return;
    try {
        const res = await fetch('/api/peak-dual/admin/initialize', {
            method: 'POST', headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            showToast('初始化完成：保留' + data.winnersCount + '名中奖者，重置' + data.resetCount + '名玩家');
            await refreshAll();
        } else { showToast(data.error || '初始化失败'); }
    } catch (e) { showToast('网络错误'); }
}

async function loadWinners() {
    try {
        const res = await fetch('/api/peak-dual/admin/winners', { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            const box = document.getElementById('winnersList');
            if (data.winners.length === 0) { box.innerHTML = '<span style="color:var(--pd-text-dim)">暂无中奖者</span>'; return; }
            box.innerHTML = data.winners.map(w =>
                `<div style="padding:6px 0; border-bottom:1px solid var(--pd-border);">
                    ${esc(w.playerTag)} (${esc(w.gameNickname)}) — ${esc(w.prizeId)} — ${formatTime(w.winTime)}
                </div>`
            ).join('');
        }
    } catch (e) { showToast('加载中奖名单失败'); }
}

async function loadPlayers() {
    try {
        const res = await fetch('/api/peak-dual/admin/players', { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            const box = document.getElementById('playersList');
            if (data.players.length === 0) { box.innerHTML = '<span style="color:var(--pd-text-dim)">暂无玩家</span>'; return; }
            box.innerHTML = '<table style="width:100%; border-collapse:collapse; font-size:12px;"><thead><tr style="text-align:left; border-bottom:1px solid var(--pd-border);">' +
                '<th style="padding:4px;">Tag</th><th>昵称</th><th>参与时间</th><th>A分</th><th>A排名</th><th>B分</th><th>B排名</th><th>权重</th><th>上次A</th><th>上次B</th><th>抽奖</th><th>中奖</th>' +
                '</tr></thead><tbody>' +
                data.players.map(p => `<tr style="border-bottom:1px solid var(--pd-border);">
                    <td style="padding:4px;">${esc(p.playerTag)}</td>
                    <td>${esc(p.gameNickname)}</td>
                    <td>${formatTime(p.joinTime)}</td>
                    <td>${p.gameAScore||0}</td><td>${p.gameARank||'—'}</td>
                    <td>${p.gameBScore||0}</td><td>${p.gameBRank||'—'}</td>
                    <td>${p.currentWeight||0}</td>
                    <td>${p.lastDrawScoreA||0}</td><td>${p.lastDrawScoreB||0}</td>
                    <td>${p.drawCount||0}</td>
                    <td>${p.hasWon?'是':'否'}</td>
                </tr>`).join('') +
                '</tbody></table>';
        }
    } catch (e) { showToast('加载玩家列表失败'); }
}

async function loadLogs() {
    try {
        const res = await fetch('/api/peak-dual/admin/logs', { headers: authHeaders() });
        const data = await res.json();
        if (data.success) {
            const box = document.getElementById('logsList');
            if (data.logs.length === 0) { box.innerHTML = '<span style="color:var(--pd-text-dim)">暂无日志</span>'; return; }
            box.innerHTML = data.logs.slice(0, 100).map(l =>
                `<div style="padding:3px 0; border-bottom:1px solid var(--pd-border);">
                    [${formatTime(l.timestamp)}] ${esc(l.playerTag)} ${l.type === 'draw' ? '抽奖' : '查询'}
                    ${l.scoreA != null ? 'A=' + l.scoreA : ''} ${l.scoreB != null ? 'B=' + l.scoreB : ''}
                    ${l.weight ? '权重=' + l.weight : ''} → ${l.result === 'win' ? '中奖' : l.result === 'lose' ? '未中' : l.result}
                </div>`
            ).join('');
        }
    } catch (e) { showToast('加载日志失败'); }
}

function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}
