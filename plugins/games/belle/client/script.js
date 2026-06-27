const difficulties = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};
let currentDiff = 'easy';
let board = [];
let revealed = [];
let flagged = [];
let gameOver = false;
let gameWon = false;
let timer = 0;
let timerInterval = null;
let firstClick = true;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let markMode = 'normal';

// ==================== 输入遥测与地雷布局哈希（防 AFK / 地雷位置篡改）====================
function createInputTracker() {
    return { count: 0, lastTime: 0, maxGap: 0, startMs: 0, endMs: 0, active: false };
}
function startInputTracker(t) {
    t.count = 0; t.lastTime = 0; t.maxGap = 0;
    t.startMs = Date.now(); t.endMs = 0; t.active = true;
}
function recordInput(t) {
    if (!t.active) return;
    const now = Date.now();
    if (t.lastTime > 0) {
        const gap = now - t.lastTime;
        if (gap > t.maxGap) t.maxGap = gap;
    }
    t.lastTime = now;
    t.count++;
}
function stopInputTracker(t) {
    t.active = false;
    t.endMs = Date.now();
    if (t.lastTime === 0) t.maxGap = t.endMs - t.startMs;
}
function getTelemetry(t) {
    return { inputCount: t.count, maxNoInputMs: t.maxGap, playedMs: t.endMs - t.startMs };
}
let inputTracker = createInputTracker();
let lockedMineHash = null; // 首点生成地雷后锁定的布局哈希

// 客户端监测器阈值（与服务端 verifyBelleAntiCheat 一致）
const acMonitor = (window.AntiCheatMonitor ? window.AntiCheatMonitor.create('belle-challenge', {
    playedMs: { min: 500 },
    maxNoInputMs: { max: 30000 },
    inputCount: { min: 3 }
}) : null);

// 计算地雷布局哈希（SHA-256）
async function computeMineHash() {
    const { rows, cols } = difficulties[currentDiff];
    const positions = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (board[i][j] === -1) positions.push(i + ',' + j);
        }
    }
    const data = new TextEncoder().encode(positions.join('|'));
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const boardEl = document.getElementById('board');
const trapsCountEl = document.getElementById('trapsCount');
const timerEl = document.getElementById('timer');
const gameStatusEl = document.getElementById('gameStatus');
const restartBtn = document.getElementById('restartBtn');
const modeHint = document.getElementById('modeHint');
const diffBtns = document.querySelectorAll('.diff-btn');
const normalModeBtn = document.getElementById('normalModeBtn');
const singleMarkBtn = document.getElementById('singleMarkBtn');
const multiMarkBtn = document.getElementById('multiMarkBtn');
const clearFlagsBtn = document.getElementById('clearFlagsBtn');

if (isMobile) {
    modeHint.classList.add('show');
}

diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDiff = btn.dataset.diff;
        initGame();
    });
});

function setMarkMode(mode) {
    markMode = mode;
    normalModeBtn.classList.toggle('active', mode === 'normal');
    singleMarkBtn.classList.toggle('active', mode === 'single');
    multiMarkBtn.classList.toggle('active', mode === 'multi');
}

normalModeBtn.addEventListener('click', () => setMarkMode('normal'));
singleMarkBtn.addEventListener('click', () => setMarkMode('single'));
multiMarkBtn.addEventListener('click', () => setMarkMode('multi'));

clearFlagsBtn.addEventListener('click', () => {
    if (gameOver || gameWon) return;
    const { rows, cols } = difficulties[currentDiff];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            flagged[i][j] = false;
        }
    }
    const { mines } = difficulties[currentDiff];
    trapsCountEl.textContent = mines;
    renderBoard();
});

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('全屏请求失败:', err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function initGame() {
    const { rows, cols, mines } = difficulties[currentDiff];

    board = [];
    revealed = [];
    flagged = [];
    gameOver = false;
    gameWon = false;
    firstClick = true;
    timer = 0;
    inputTracker = createInputTracker();
    lockedMineHash = null;
    if (acMonitor) acMonitor.reset();
    if (window.SessionGuard) window.SessionGuard.start('belle-challenge');

    if (timerInterval) clearInterval(timerInterval);
    timerEl.textContent = '000';
    trapsCountEl.textContent = mines;
    gameStatusEl.className = 'game-status';
    gameStatusEl.textContent = '';

    for (let i = 0; i < rows; i++) {
        board[i] = [];
        revealed[i] = [];
        flagged[i] = [];
        for (let j = 0; j < cols; j++) {
            board[i][j] = 0;
            revealed[i][j] = false;
            flagged[i][j] = false;
        }
    }
    renderBoard();
}

function placeMines(excludeRow, excludeCol) {
    const { rows, cols, mines } = difficulties[currentDiff];
    let placed = 0;
    while (placed < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        if (board[r][c] !== -1 && !(Math.abs(r - excludeRow) <= 1 && Math.abs(c - excludeCol) <= 1)) {
            board[r][c] = -1;
            placed++;
        }
    }
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (board[i][j] !== -1) {
                board[i][j] = countAdjacentMines(i, j);
            }
        }
    }
}

function countAdjacentMines(row, col) {
    const { rows, cols } = difficulties[currentDiff];
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const r = row + i;
            const c = col + j;
            if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === -1) {
                count++;
            }
        }
    }
    return count;
}

function renderBoard() {
    const { rows, cols } = difficulties[currentDiff];
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;

            if (revealed[i][j]) {
                cell.classList.add('revealed');
                if (board[i][j] === -1) {
                    cell.classList.add('mine');
                    cell.textContent = '💥';
                } else if (board[i][j] > 0) {
                    cell.textContent = board[i][j];
                    cell.dataset.num = board[i][j];
                }
            } else if (flagged[i][j]) {
                cell.classList.add('flagged');
                cell.textContent = '🚩';
            }

            cell.addEventListener('click', (e) => {
                if (!isMobile) {
                    handleClick(i, j);
                }
            });
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (!isMobile) {
                    handleRightClick(i, j);
                }
            });

            if (isMobile) {
                let longPressTimer;
                let isLongPress = false;

                cell.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    isLongPress = false;
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        handleRightClick(i, j);
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }, 500);
                }, { passive: false });

                cell.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    clearTimeout(longPressTimer);
                    if (!isLongPress) {
                        handleClick(i, j);
                    }
                }, { passive: false });

                cell.addEventListener('touchmove', (e) => {
                    clearTimeout(longPressTimer);
                }, { passive: false });
            }

            boardEl.appendChild(cell);
        }
    }
}

function handleClick(row, col) {
    if (gameOver || gameWon || revealed[row][col]) return;
    recordInput(inputTracker);

    if (markMode === 'single' || markMode === 'multi') {
        if (flagged[row][col]) {
            flagged[row][col] = false;
        } else {
            flagged[row][col] = true;
        }

        const { mines } = difficulties[currentDiff];
        const flagCount = flagged.flat().filter(f => f).length;
        trapsCountEl.textContent = mines - flagCount;
        renderBoard();

        if (markMode === 'single') {
            setMarkMode('normal');
        }
        return;
    }

    if (flagged[row][col]) return;

    if (firstClick) {
        firstClick = false;
        placeMines(row, col);
        // 异步锁定地雷布局哈希（防篡改地雷位置）
        computeMineHash().then(h => { lockedMineHash = h; });
        startInputTracker(inputTracker);
        startTimer();
    }

    reveal(row, col);
    renderBoard();
    checkWin();
}

function handleRightClick(row, col) {
    if (gameOver || gameWon || revealed[row][col]) return;
    recordInput(inputTracker);

    flagged[row][col] = !flagged[row][col];

    const { mines } = difficulties[currentDiff];
    const flagCount = flagged.flat().filter(f => f).length;
    trapsCountEl.textContent = mines - flagCount;
    renderBoard();
}

function reveal(row, col) {
    const { rows, cols } = difficulties[currentDiff];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (revealed[row][col] || flagged[row][col]) return;

    revealed[row][col] = true;

    if (board[row][col] === -1) {
        gameOver = true;
        revealAllMines();
        showStatus('lose', '💥 踩到陷阱了！游戏结束');
        clearInterval(timerInterval);
        return;
    }

    if (board[row][col] === 0) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                reveal(row + i, col + j);
            }
        }
    }
}

function revealAllMines() {
    const { rows, cols } = difficulties[currentDiff];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (board[i][j] === -1) {
                revealed[i][j] = true;
            }
        }
    }
}

function checkWin() {
    // 踩雷后 gameOver=true，revealAllMines 已把所有雷格标为 revealed，
    // 此时 revealedCount 会被雷格凑数误判为胜利，必须直接返回
    if (gameOver) return;
    const { rows, cols, mines } = difficulties[currentDiff];
    let revealedCount = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            // 双重保险：只统计已揭开的非雷格，雷格不计入胜利进度
            if (revealed[i][j] && board[i][j] !== -1) revealedCount++;
        }
    }
    if (revealedCount === rows * cols - mines) {
        gameWon = true;
        showStatus('win', '🎉 恭喜！你成功避开了所有陷阱！');
        clearInterval(timerInterval);
        stopInputTracker(inputTracker);
        submitScore(timer);
    }
}

function showStatus(type, message) {
    gameStatusEl.className = `game-status ${type}`;
    gameStatusEl.textContent = message;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        timerEl.textContent = String(timer).padStart(3, '0');
    }, 1000);
}

restartBtn.addEventListener('click', initGame);

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

function showLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
    loadLeaderboard();
}

function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

async function loadLeaderboard() {
    const listContainer = document.getElementById('leaderboardList');
    listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">加载中...</div>';

    try {
        const response = await fetch('/api/leaderboard/belle-challenge');
        const data = await response.json();

        if (data.success && data.leaderboard.length > 0) {
            listContainer.innerHTML = data.leaderboard.map((item, index) => `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${index < 3 ? 'rank-' + (index + 1) : 'rank-other'}">
                        ${index + 1}
                    </div>
                    <div class="leaderboard-name">${escapeHtml(item.nickname)}</div>
                    <div class="leaderboard-score">
                        ${item.score}
                        <span class="leaderboard-unit">${data.config.unit}</span>
                    </div>
                </div>
            `).join('');
        } else {
            listContainer.innerHTML = `
                <div class="leaderboard-empty">
                    <div class="leaderboard-empty-icon">🎯</div>
                    <p>暂无排行记录</p>
                    <p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p>
                </div>
            `;
        }
    } catch (error) {
        listContainer.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">❌</div>
                <p>加载失败</p>
                <p style="font-size:12px;margin-top:5px;">请确保服务器已启动</p>
            </div>
        `;
    }
}

async function submitScore(score) {
    const nickname = localStorage.getItem('gameNickname');
    if (!nickname || !nickname.trim()) {
        console.log('未设置昵称，跳过成绩提交');
        return;
    }
    if (!window.ScoreSigner) {
        console.log('ScoreSigner 未加载，跳过成绩提交');
        return;
    }

    // 1. 会话完整性校验（History API）
    if (window.SessionGuard) {
        const sess = window.SessionGuard.verify();
        if (!sess.ok) {
            if (acMonitor) acMonitor.alert('会话校验失败：' + sess.reason);
            console.log('会话校验失败，跳过提交:', sess.reason);
            return;
        }
    }

    // 2. 地雷布局哈希校验（防篡改地雷位置）
    if (lockedMineHash) {
        const currentHash = await computeMineHash();
        if (currentHash !== lockedMineHash) {
            if (acMonitor) acMonitor.alert('检测到地雷布局被篡改，已阻止成绩提交');
            console.log('地雷布局哈希不一致，跳过提交');
            return;
        }
    }

    // 3. 注入检测
    if (window.SessionGuard && window.SessionGuard.detectInjection()) {
        if (acMonitor) acMonitor.alert('检测到 History API 被恶意注入，已阻止成绩提交');
        console.log('History API 注入检测失败，跳过提交');
        return;
    }

    const diffMap = { 'easy': 'easy', 'medium': 'normal', 'hard': 'hard' };
    const difficulty = diffMap[currentDiff] || 'normal';
    const { rows, cols, mines } = difficulties[currentDiff];

    // 4. 计算游戏状态快照
    let revealedCount = 0;
    let flagCount = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (revealed[i][j] && board[i][j] !== -1) revealedCount++;
            if (flagged[i][j]) flagCount++;
        }
    }
    const telemetry = getTelemetry(inputTracker);

    // 5. 客户端监测器预警
    if (acMonitor) {
        const snapshot = {
            playedMs: telemetry.playedMs,
            maxNoInputMs: telemetry.maxNoInputMs,
            inputCount: telemetry.inputCount
        };
        const result = acMonitor.check(snapshot);
        if (!result.ok) {
            acMonitor.alert(result.violations.join('\n'));
            console.log('客户端监测器检测到异常，跳过提交:', result.violations);
            return;
        }
    }

    try {
        const sig = await window.ScoreSigner.sign({ gameId: 'belle-challenge', nickname, score });
        const response = await fetch('/api/leaderboard/belle-challenge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname,
                score: score,
                extra: {
                    difficulty: difficulty,
                    antiCheat: {
                        mineCount: mines,
                        totalCells: rows * cols,
                        revealedCount: revealedCount,
                        flagCount: flagCount,
                        won: true,
                        playedMs: telemetry.playedMs,
                        inputCount: telemetry.inputCount,
                        maxNoInputMs: telemetry.maxNoInputMs,
                        minePositionsHash: lockedMineHash || ''
                    }
                },
                timestamp: sig.timestamp,
                nonce: sig.nonce,
                signature: sig.signature
            })
        });

        // 安全事件统一入口：403 封禁 / 200 警告（成绩不上传）自动弹窗
        if (window.BanNotice && await window.BanNotice.handleSecurityEvent(response)) return;
        const data = await response.json().catch(() => ({}));
        if (data.success) {
            console.log(`成绩提交成功！排名：${data.rank}/${data.total}`);
        } else {
            console.log('成绩提交失败:', data.error);
        }
    } catch (error) {
        console.log('提交成绩失败（服务器可能未启动）:', error);
    } finally {
        if (window.SessionGuard) window.SessionGuard.end();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('leaderboardModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeLeaderboard();
    }
});

initGame();