/**
 * 客栈迎新 - 玩家页逻辑
 * ======================
 * 依赖：/api/activity/inn-welcome（活动配置）、/api/leaderboard/:game/user/:nickname（成绩）、/api/inn-welcome/submit（提交）
 * 昵称默认回填 localStorage.gameNickname。
 */

let activityConfig = null;
let currentScores = null; // 提交前缓存的成绩快照 { gameId: {score,rank,sort,unit,total} | null }

document.addEventListener('DOMContentLoaded', init);

async function init() {
    const nick = localStorage.getItem('gameNickname') || '';
    if (nick) document.getElementById('nicknameInput').value = nick;
    await loadConfig();
    startCountdown();
}

async function loadConfig() {
    try {
        const res = await fetch('/api/activity/inn-welcome');
        const data = await res.json();
        if (data.success && data.activity) {
            activityConfig = data.activity;
            renderHeader();
            renderRules();
            if (activityConfig.tag && activityConfig.tag.hint) {
                document.getElementById('tagHint').textContent = activityConfig.tag.hint;
            }
        }
    } catch (e) {
        console.error('加载活动配置失败:', e);
        showToast('活动配置加载失败，使用默认设置');
    }
}

function renderHeader() {
    if (!activityConfig) return;
    document.getElementById('activityIcon').textContent = activityConfig.icon || '🏨';
    document.getElementById('activityTitle').textContent = activityConfig.name || '客栈迎新';
    document.getElementById('activitySubtitle').textContent = activityConfig.description || '';
}

function renderRules() {
    const list = document.getElementById('rulesList');
    const games = (activityConfig && activityConfig.games) || [];
    const gameNames = games.map(g => g.name).join('、');
    list.innerHTML = `
        <li>填写你的<b>游戏昵称</b>和<b>游戏标签</b>（${escapeHtml(activityConfig?.tag?.hint || '以#开头大写字母数字')}）</li>
        <li>点击「查询我的成绩」，系统将读取你在 <b>${escapeHtml(gameNames)}</b> 五款游戏的排行榜成绩</li>
        <li>点击「提交成绩参与抽奖」，成绩即发送至管理员，参与宝石抽奖</li>
        <li>活动时间：${formatDate(activityConfig?.startTime)} — ${formatDate(activityConfig?.endTime)}</li>
    `;
}

function startCountdown() {
    const end = activityConfig && new Date(activityConfig.endTime);
    const start = activityConfig && new Date(activityConfig.startTime);
    const el = document.getElementById('activityCountdown');
    function tick() {
        const now = new Date();
        if (start && now < start) {
            el.textContent = '⏰ 距活动开始还有 ' + diffText(start - now);
        } else if (end && now < end) {
            el.textContent = '⏰ 距活动结束还有 ' + diffText(end - now);
        } else {
            el.textContent = '活动已结束';
        }
        setTimeout(tick, 60000);
    }
    tick();
}

function diffText(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    let t = '';
    if (d > 0) t += d + '天';
    t += h + '时' + m + '分';
    return t;
}

function formatDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 校验输入并查询 5 款游戏成绩 */
async function queryScores() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const tag = document.getElementById('tagInput').value.trim();
    if (!nickname) { showToast('请输入游戏昵称'); return; }
    const pat = activityConfig && activityConfig.tag && activityConfig.tag.pattern;
    if (pat && !(new RegExp(pat).test(tag))) { showToast('游戏标签格式不正确'); return; }

    localStorage.setItem('gameNickname', nickname);

    const btn = document.getElementById('queryBtn');
    btn.disabled = true;
    btn.textContent = '🔍 查询中...';

    const games = (activityConfig && activityConfig.games) || [];
    currentScores = {};

    await Promise.all(games.map(async g => {
        try {
            const res = await fetch('/api/leaderboard/' + g.id + '/user/' + encodeURIComponent(nickname));
            if (!res.ok) { currentScores[g.id] = null; return; }
            const data = await res.json();
            if (data.success && data.bestScore != null) {
                currentScores[g.id] = {
                    score: data.bestScore,
                    rank: data.rank,
                    sort: data.config && data.config.sort,
                    unit: data.config && data.config.unit,
                    total: data.total
                };
            } else {
                currentScores[g.id] = null;
            }
        } catch (e) {
            currentScores[g.id] = null;
        }
    }));

    renderScores(games);
    btn.disabled = false;
    btn.textContent = '🔍 查询我的成绩';
    document.getElementById('scoresSection').style.display = 'block';
    document.getElementById('scoresSection').scrollIntoView({ behavior: 'smooth' });
}

function renderScores(games) {
    const body = document.getElementById('scoresBody');
    body.innerHTML = games.map(g => {
        const s = currentScores[g.id];
        let scoreCell, rankCell, note;
        if (s && s.score != null) {
            scoreCell = `${s.score}<span class="unit">${escapeHtml(s.unit || '')}</span>`;
            rankCell = s.rank ? `第 ${s.rank} 名` : '—';
            note = s.sort === 'asc' ? '用时越短越好' : '得分越高越好';
        } else {
            scoreCell = '<span class="no-record">暂无记录</span>';
            rankCell = '—';
            note = `<a class="play-link" href="${g.pageUrl}" target="_blank">去试玩 →</a>`;
        }
        return `<tr>
            <td class="game-cell">${g.icon || ''} ${escapeHtml(g.name)}</td>
            <td class="score-cell">${scoreCell}</td>
            <td>${rankCell}</td>
            <td class="note-cell">${note}</td>
        </tr>`;
    }).join('');
}

/** 提交成绩到后端 */
async function submitScores() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const tag = document.getElementById('tagInput').value.trim();
    if (!nickname) { showToast('请输入游戏昵称'); return; }
    const pat = activityConfig && activityConfig.tag && activityConfig.tag.pattern;
    if (pat && !(new RegExp(pat).test(tag))) { showToast('游戏标签格式不正确'); return; }
    if (!currentScores) { showToast('请先查询成绩'); return; }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '提交中...';

    try {
        const res = await fetch('/api/inn-welcome/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, tag, scores: currentScores })
        });
        const data = await res.json();
        if (data.success) {
            const played = Object.values(currentScores).filter(s => s && s.score != null).length;
            document.getElementById('resultText').textContent =
                `昵称：${nickname}　标签：${tag}　已提交 ${played}/5 款游戏成绩，等待管理员抽奖。`;
            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
            showToast('提交成功！');
        } else {
            showToast(data.error || '提交失败');
        }
    } catch (e) {
        showToast('网络错误，提交失败');
    } finally {
        btn.disabled = false;
        btn.textContent = '📤 提交成绩参与抽奖';
    }
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
