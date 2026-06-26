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

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const bestScoreEl = document.getElementById('bestScore');
const bricksLeftEl = document.getElementById('bricksLeft');
const gameStatusEl = document.getElementById('gameStatus');
const startHint = document.getElementById('startHint');
const diffBtns = document.querySelectorAll('.diff-btn');
const mobileControls = document.getElementById('mobileControls');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const launchBtn = document.getElementById('launchBtn');

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    mobileControls.classList.add('show');
}

let gameState = 'ready';
let score = 0;
let lives = 3;
let bestScore = parseInt(localStorage.getItem('busterBestScore')) || 0;
let difficulty = 'easy';
let lastTime = 0;

const difficulties = {
    easy: { ballSpeed: 2, paddleWidth: 120, brickRows: 3, brickCols: 7, paddleSpeed: 5 },
    normal: { ballSpeed: 3, paddleWidth: 100, brickRows: 4, brickCols: 8, paddleSpeed: 6 },
    hard: { ballSpeed: 4, paddleWidth: 80, brickRows: 5, brickCols: 9, paddleSpeed: 7 }
};

bestScoreEl.textContent = bestScore;

let paddle = {
    x: 0,
    y: 0,
    width: 80,
    height: 15,
    speed: 7,
    dx: 0
};

let ball = {
    x: 0,
    y: 0,
    radius: 8,
    dx: 0,
    dy: 0,
    speed: 5
};

let bricks = [];
let powerUps = [];
let particles = [];

const brickColors = [
    { color: '#ff6b6b', points: 10, hits: 1 },
    { color: '#ffd43b', points: 20, hits: 1 },
    { color: '#69db7c', points: 30, hits: 1 },
    { color: '#74c0fc', points: 40, hits: 1 },
    { color: '#da77f2', points: 50, hits: 2 },
    { color: '#ffd700', points: 100, hits: 2 }
];

const powerUpTypes = [
    { type: 'wide', color: '#4caf50', emoji: '⬅️➡️', duration: 10000 },
    { type: 'slow', color: '#2196f3', emoji: '🐢', duration: 8000 },
    { type: 'multiball', color: '#9c27b0', emoji: '🎾🎾', duration: 0 },
    { type: 'life', color: '#f44336', emoji: '❤️', duration: 0 }
];

let activePowerUps = {};
let extraBalls = [];

let keys = {
    left: false,
    right: false
};

function initGame() {
    const diff = difficulties[difficulty];

    score = 0;
    lives = 3;
    gameState = 'ready';
    bricks = [];
    powerUps = [];
    particles = [];
    extraBalls = [];
    activePowerUps = {};

    scoreEl.textContent = score;
    livesEl.textContent = lives;
    gameStatusEl.classList.remove('show');
    startHint.style.display = 'block';

    paddle.width = diff.paddleWidth;
    paddle.speed = diff.paddleSpeed;
    paddle.x = canvas.width / 2 - paddle.width / 2;
    paddle.y = canvas.height - 30;
    paddle.dx = 0;

    ball.speed = diff.ballSpeed;
    resetBall();

    createBricks(diff.brickRows, diff.brickCols);
    updateBricksLeft();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = paddle.y - ball.radius - 5;
    ball.dx = 0;
    ball.dy = 0;
    extraBalls = [];
}

function createBricks(rows, cols) {
    const brickWidth = (canvas.width - 40) / cols - 5;
    const brickHeight = 20;
    const startX = 20;
    const startY = 50;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const colorIndex = Math.min(row, brickColors.length - 1);
            const brickType = brickColors[colorIndex];

            bricks.push({
                x: startX + col * (brickWidth + 5),
                y: startY + row * (brickHeight + 5),
                width: brickWidth,
                height: brickHeight,
                color: brickType.color,
                points: brickType.points,
                hits: brickType.hits,
                maxHits: brickType.hits,
                visible: true
            });
        }
    }
}

function updateBricksLeft() {
    const remaining = bricks.filter(b => b.visible).length;
    bricksLeftEl.textContent = remaining;
}

function launchBall() {
    if (gameState !== 'ready') return;

    gameState = 'playing';
    startHint.style.display = 'none';

    const angle = (Math.random() * 60 - 30) * Math.PI / 180;
    ball.dx = Math.sin(angle) * ball.speed;
    ball.dy = -Math.cos(angle) * ball.speed;
}

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 16.67;
    lastTime = currentTime;

    update(deltaTime);
    draw();

    if (gameState !== 'gameover' && gameState !== 'win') {
        requestAnimationFrame(gameLoop);
    }
}

function update(deltaTime) {
    if (gameState !== 'playing') {
        if (gameState === 'ready') {
            ball.x = paddle.x + paddle.width / 2;
        }
        return;
    }

    updatePaddle(deltaTime);
    updateBall(ball, deltaTime);

    extraBalls.forEach((b, i) => {
        updateBall(b, deltaTime);
        if (b.y > canvas.height) {
            extraBalls.splice(i, 1);
        }
    });

    updatePowerUps(deltaTime);
    updateParticles(deltaTime);

    const remainingBricks = bricks.filter(b => b.visible).length;
    if (remainingBricks === 0) {
        winGame();
    }
}

function updatePaddle(deltaTime) {
    let paddleSpeed = paddle.speed;
    if (activePowerUps.wide) {
        paddleSpeed *= 0.8;
    }

    if (keys.left) {
        paddle.x -= paddleSpeed * deltaTime;
    }
    if (keys.right) {
        paddle.x += paddleSpeed * deltaTime;
    }

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
}

function updateBall(b, deltaTime) {
    let speedMultiplier = 1;
    if (activePowerUps.slow) {
        speedMultiplier = 0.6;
    }

    b.x += b.dx * speedMultiplier * deltaTime;
    b.y += b.dy * speedMultiplier * deltaTime;

    if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.dx = -b.dx;
    }
    if (b.x + b.radius > canvas.width) {
        b.x = canvas.width - b.radius;
        b.dx = -b.dx;
    }
    if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.dy = -b.dy;
    }

    if (b.y + b.radius > paddle.y &&
        b.y - b.radius < paddle.y + paddle.height &&
        b.x > paddle.x &&
        b.x < paddle.x + paddle.width) {

        const hitPos = (b.x - paddle.x) / paddle.width;
        const angle = (hitPos - 0.5) * Math.PI * 0.7;
        const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);

        b.dx = Math.sin(angle) * speed;
        b.dy = -Math.abs(Math.cos(angle) * speed);
        b.y = paddle.y - b.radius;

        createParticles(b.x, b.y, '#ffffff', 5);
    }

    bricks.forEach(brick => {
        if (!brick.visible) return;

        if (b.x + b.radius > brick.x &&
            b.x - b.radius < brick.x + brick.width &&
            b.y + b.radius > brick.y &&
            b.y - b.radius < brick.y + brick.height) {

            brick.hits--;

            if (brick.hits <= 0) {
                brick.visible = false;
                score += brick.points;
                scoreEl.textContent = score;
                updateBricksLeft();

                createParticles(
                    brick.x + brick.width / 2,
                    brick.y + brick.height / 2,
                    brick.color,
                    10
                );

                if (Math.random() < 0.15) {
                    spawnPowerUp(
                        brick.x + brick.width / 2,
                        brick.y + brick.height / 2
                    );
                }
            } else {
                createParticles(
                    brick.x + brick.width / 2,
                    brick.y + brick.height / 2,
                    brick.color,
                    3
                );
            }

            const overlapLeft = b.x + b.radius - brick.x;
            const overlapRight = brick.x + brick.width - (b.x - b.radius);
            const overlapTop = b.y + b.radius - brick.y;
            const overlapBottom = brick.y + brick.height - (b.y - b.radius);

            const minOverlapX = Math.min(overlapLeft, overlapRight);
            const minOverlapY = Math.min(overlapTop, overlapBottom);

            if (minOverlapX < minOverlapY) {
                b.dx = -b.dx;
            } else {
                b.dy = -b.dy;
            }
        }
    });

    if (b === ball && b.y > canvas.height) {
        if (extraBalls.length > 0) {
            const newMain = extraBalls.shift();
            ball.x = newMain.x;
            ball.y = newMain.y;
            ball.dx = newMain.dx;
            ball.dy = newMain.dy;
        } else {
            loseLife();
        }
    }
}

function spawnPowerUp(x, y) {
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    powerUps.push({
        x: x,
        y: y,
        width: 30,
        height: 20,
        dy: 2,
        type: type.type,
        color: type.color,
        emoji: type.emoji,
        duration: type.duration
    });
}

function updatePowerUps(deltaTime) {
    powerUps.forEach((powerUp, index) => {
        powerUp.y += powerUp.dy * deltaTime;

        if (powerUp.y + powerUp.height > paddle.y &&
            powerUp.y < paddle.y + paddle.height &&
            powerUp.x + powerUp.width > paddle.x &&
            powerUp.x < paddle.x + paddle.width) {

            applyPowerUp(powerUp);
            powerUps.splice(index, 1);
        }

        if (powerUp.y > canvas.height) {
            powerUps.splice(index, 1);
        }
    });

    Object.keys(activePowerUps).forEach(type => {
        if (activePowerUps[type] > 0) {
            activePowerUps[type] -= 16 * deltaTime;
            if (activePowerUps[type] <= 0) {
                removePowerUp(type);
            }
        }
    });
}

function applyPowerUp(powerUp) {
    createParticles(powerUp.x, powerUp.y, powerUp.color, 15);

    switch (powerUp.type) {
        case 'wide':
            activePowerUps.wide = powerUp.duration;
            paddle.width *= 1.5;
            break;
        case 'slow':
            activePowerUps.slow = powerUp.duration;
            break;
        case 'multiball':
            for (let i = 0; i < 2; i++) {
                extraBalls.push({
                    x: ball.x,
                    y: ball.y,
                    radius: ball.radius,
                    dx: ball.dx * (i === 0 ? 0.8 : -0.8),
                    dy: ball.dy
                });
            }
            break;
        case 'life':
            lives = Math.min(lives + 1, 5);
            livesEl.textContent = lives;
            break;
    }
}

function removePowerUp(type) {
    delete activePowerUps[type];

    if (type === 'wide') {
        paddle.width = difficulties[difficulty].paddleWidth;
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 3 + 1,
            color: color,
            life: 1
        });
    }
}

function updateParticles(deltaTime) {
    particles.forEach((p, index) => {
        p.x += p.dx * deltaTime;
        p.y += p.dy * deltaTime;
        p.life -= 0.02 * deltaTime;

        if (p.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

function loseLife() {
    lives--;
    livesEl.textContent = lives;

    if (lives <= 0) {
        gameOver();
    } else {
        gameState = 'ready';
        resetBall();
        startHint.style.display = 'block';
        activePowerUps = {};
        paddle.width = difficulties[difficulty].paddleWidth;
    }
}

function gameOver() {
    gameState = 'gameover';

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('busterBestScore', bestScore);
        bestScoreEl.textContent = bestScore;
    }

    submitScore(score);

    gameStatusEl.className = 'game-status show lose';
    gameStatusEl.innerHTML = `
        💔 游戏结束！<br>
        最终得分：${score} 分
    `;
}

function winGame() {
    gameState = 'win';

    const bonus = lives * 100;
    score += bonus;
    scoreEl.textContent = score;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('busterBestScore', bestScore);
        bestScoreEl.textContent = bestScore;
    }

    submitScore(score);

    gameStatusEl.className = 'game-status show win';
    gameStatusEl.innerHTML = `
        🎉 恭喜通关！<br>
        总得分：${score} 分<br>
        <small>生命奖励：+${bonus} 分</small>
    `;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawBricks();
    drawPowerUps();
    drawPaddle();
    drawBall(ball);
    extraBalls.forEach(b => drawBall(b));
    drawParticles();
}

function drawBackground() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let i = 0; i < canvas.width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
}

function drawBricks() {
    bricks.forEach(brick => {
        if (!brick.visible) return;

        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(brick.x, brick.y, brick.width, 3);

        if (brick.hits < brick.maxHits) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
    });
}

function drawPaddle() {
    const gradient = ctx.createLinearGradient(
        paddle.x, paddle.y,
        paddle.x, paddle.y + paddle.height
    );
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 5);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(paddle.x + 5, paddle.y + 2, paddle.width - 10, 3);

    ctx.font = '12px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('🎬', paddle.x + paddle.width / 2, paddle.y + paddle.height - 3);
}

function drawBall(b) {
    const gradient = ctx.createRadialGradient(
        b.x - 2, b.y - 2, 0,
        b.x, b.y, b.radius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#ffd700');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawPowerUps() {
    powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.roundRect(
            powerUp.x - powerUp.width / 2,
            powerUp.y - powerUp.height / 2,
            powerUp.width,
            powerUp.height,
            5
        );
        ctx.fill();

        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.emoji, powerUp.x, powerUp.y);
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys.left = true;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys.right = true;
    }
    if (e.key === ' ') {
        e.preventDefault();
        launchBall();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys.left = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys.right = false;
    }
});

leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.left = true;
});
leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.left = false;
});
leftBtn.addEventListener('mousedown', () => {
    keys.left = true;
});
leftBtn.addEventListener('mouseup', () => {
    keys.left = false;
});
leftBtn.addEventListener('mouseleave', () => {
    keys.left = false;
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    keys.right = true;
});
rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.right = false;
});
rightBtn.addEventListener('mousedown', () => {
    keys.right = true;
});
rightBtn.addEventListener('mouseup', () => {
    keys.right = false;
});
rightBtn.addEventListener('mouseleave', () => {
    keys.right = false;
});

launchBtn.addEventListener('click', () => {
    launchBall();
});

canvas.addEventListener('click', () => {
    launchBall();
});

diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.dataset.diff;
        resetGame();
    });
});

function resetGame() {
    initGame();
}

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
        const response = await fetch('/api/leaderboard/buster-montage');
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

    try {
        const sig = await window.ScoreSigner.sign({ gameId: 'buster-montage', nickname, score });
        const response = await fetch('/api/leaderboard/buster-montage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname,
                score: score,
                extra: { difficulty: difficulty },
                timestamp: sig.timestamp,
                nonce: sig.nonce,
                signature: sig.signature
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