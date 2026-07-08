/**
 * 巅峰双重挑战 - 玩家页面逻辑
 */

const TAG_PATTERN = /^#[0289PYLQGRJCUV]{2,14}$/;
let currentPlayerTag = '';
let currentWeight = 0;
let lastDrawWeight = 0;
let drawCount = 0;
let maxDraws = 5;

// 时间守卫：未到开始时间则跳转回活动中心
(async function checkActivityTime() {
    try {
        const res = await fetch('/api/activities');
        const data = await res.json();
        const activity = (data.activities || []).find(a => a.id === 'peak-dual');
        if (activity && new Date() < new Date(activity.startTime)) {
            alert('活动尚未开始，请于活动开始后再来');
            window.location.href = '/activity.html';
        }
    } catch (e) { /* 查询失败不阻塞，由后端 API 兜底 */ }
})();

document.addEventListener('DOMContentLoaded', () => {
    const savedNick = localStorage.getItem('gameNickname');
    if (savedNick) document.getElementById('gameNickname').value = savedNick;
    const tagInput = document.getElementById('playerTag');
    tagInput.addEventListener('input', validateTagInput);
});

function validateTagInput() {
    const input = document.getElementById('playerTag');
    const hint = document.getElementById('tagHint');
    const val = input.value.trim();
    if (!val) { hint.textContent = '以 # 开头，仅含 0289PYLQGRJCUV，总长 3-15 位'; hint.classList.remove('error'); return; }
    if (val[0] !== '#') { hint.textContent = '请使用英文半角 # 开头'; hint.classList.add('error'); return; }
    if (/[^#0289PYLQGRJCUV]/.test(val)) { hint.textContent = '包含非法字符，仅允许 0289PYLQGRJCUV'; hint.classList.add('error'); return; }
    if (val.length < 3 || val.length > 15) { hint.textContent = '长度需 3-15 位'; hint.classList.add('error'); return; }
    hint.textContent = '格式正确'; hint.classList.remove('error');
}

async function doBind() {
    const tag = document.getElementById('playerTag').value.trim();
    const nick = document.getElementById('gameNickname').value.trim();
    if (!TAG_PATTERN.test(tag)) { showToast('Player Tag 格式不正确'); return; }
    if (!nick) { showToast('游戏昵称不能为空'); return; }
    const btn = document.getElementById('bindBtn');
    btn.disabled = true; btn.textContent = '绑定中...';
    try {
        const res = await fetch('/api/peak-dual/bind', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerTag: tag, gameNickname: nick })
        });
        const data = await res.json();
        if (data.success) {
            currentPlayerTag = tag;
            localStorage.setItem('gameNickname', nick);
            showMainCard();
            await doQuery();
        } else { showToast(data.error || '绑定失败'); }
    } catch (e) { showToast('网络错误'); }
    btn.disabled = false; btn.textContent = '绑定并查询成绩';
}

function showMainCard() {
    document.getElementById('bindCard').classList.add('pd-hidden');
    document.getElementById('mainCard').classList.remove('pd-hidden');
}

async function doQuery() {
    if (!currentPlayerTag) return;
    try {
        const res = await fetch('/api/peak-dual/query', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerTag: currentPlayerTag })
        });
        const data = await res.json();
        if (data.success) { updateUI(data.player, data.config); }
        else { showToast(data.error || '查询失败'); }
    } catch (e) { showToast('网络错误'); }
}

function updateUI(player, config) {
    currentWeight = player.currentWeight || 0;
    lastDrawWeight = player.lastDrawWeight || 0;
    drawCount = player.drawCount || 0;
    maxDraws = config ? (config.maxDrawsPerPlayer || 5) : 5;

    document.getElementById('scoreA').textContent = player.gameAScore || 0;
    document.getElementById('rankA').textContent = player.gameARank ? '第' + player.gameARank + '名' : '未排名';
    document.getElementById('scoreB').textContent = player.gameBScore || 0;
    document.getElementById('rankB').textContent = player.gameBRank ? '第' + player.gameBRank + '名' : '未排名';
    document.getElementById('currentWeight').textContent = currentWeight;

    const drawsLeft = maxDraws - drawCount;
    document.getElementById('drawsLeft').textContent = drawsLeft + ' / ' + maxDraws;
    document.getElementById('prizeLeft').textContent = (config ? config.remainPrize : 20) + ' / ' + (config ? config.totalPrize : 20);
    document.getElementById('lastWeight').textContent = lastDrawWeight || '—';
    document.getElementById('nowWeight').textContent = currentWeight;

    const drawBtn = document.getElementById('drawBtn');
    const elig = document.getElementById('eligibility');

    if (player.hasWon) {
        drawBtn.disabled = true;
        elig.className = 'pd-eligibility ok';
        elig.textContent = '已中奖，活动完成';
    } else if (drawsLeft <= 0) {
        drawBtn.disabled = true;
        elig.className = 'pd-eligibility no';
        elig.textContent = '已达最大抽奖次数';
    } else if (config && config.remainPrize <= 0) {
        drawBtn.disabled = true;
        elig.className = 'pd-eligibility no';
        elig.textContent = '奖品已发完';
    } else if (drawCount > 0 && currentWeight <= lastDrawWeight) {
        drawBtn.disabled = true;
        elig.className = 'pd-eligibility no';
        elig.textContent = '成绩未提升，需超过上次(' + lastDrawWeight + ')';
    } else {
        drawBtn.disabled = false;
        elig.className = 'pd-eligibility ok';
        elig.textContent = '已满足抽奖条件';
    }
}

async function doDraw() {
    if (!currentPlayerTag) return;
    const btn = document.getElementById('drawBtn');
    btn.disabled = true; btn.textContent = '抽奖中...';
    try {
        const res = await fetch('/api/peak-dual/draw', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerTag: currentPlayerTag })
        });
        const data = await res.json();
        if (data.success) {
            updateUI(data.player, data.config);
            showResult(data.won, data.isPityDraw);
        } else { showToast(data.error || '抽奖失败'); }
    } catch (e) { showToast('网络错误'); }
    btn.textContent = '立即抽奖';
}

function showResult(won, isPity) {
    const modal = document.getElementById('resultModal');
    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDesc');
    if (won) {
        icon.textContent = '🎉';
        title.textContent = '恭喜中奖！';
        desc.textContent = '为了让更多玩家有机会参与，每位玩家仅可中奖一次。';
    } else {
        icon.textContent = isPity ? '🍀' : '💪';
        title.textContent = isPity ? '保底未触发' : '未中奖';
        desc.textContent = isPity ? '需提升成绩才能触发保底' : '继续提升成绩，下次再来！';
    }
    modal.classList.add('show');
}

function closeResult() {
    document.getElementById('resultModal').classList.remove('show');
}

let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
