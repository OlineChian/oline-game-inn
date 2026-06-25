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
        startTimer();
    }

    reveal(row, col);
    renderBoard();
    checkWin();
}

function handleRightClick(row, col) {
    if (gameOver || gameWon || revealed[row][col]) return;

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
    const { rows, cols, mines } = difficulties[currentDiff];
    let revealedCount = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (revealed[i][j]) revealedCount++;
        }
    }
    if (revealedCount === rows * cols - mines) {
        gameWon = true;
        showStatus('win', '🎉 恭喜！你成功避开了所有陷阱！');
        clearInterval(timerInterval);
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

    const diffMap = { 'easy': 'easy', 'medium': 'normal', 'hard': 'hard' };

    try {
        const response = await fetch('/api/leaderboard/belle-challenge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname,
                score: score,
                extra: { difficulty: diffMap[currentDiff] || 'normal' }
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log(`成绩提交成功！排名：${data.rank}/${data.total}`);
        }
    } catch (error) {
        console.log('提交成绩失败（服务器可能未启动）:', error);
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