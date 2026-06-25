/**
 * 8比特街机 - 经典跑酷联机对战
 * 客户端入口
 */

const socket = io('/8bit-arcade');

// 游戏状态
let currentRoom = null;
let currentPlayer = null;
let gameState = null;
let isHost = false;
let localScore = 0;
let opponentScore = 0;
let gameLoop = null;
let playerY = 0;
let obstacles = [];
let coins = [];
let gameSpeed = 3;
let playerSpeed = 8;
let isJumping = false;
let jumpVelocity = 0;
let isGameOver = false;
let animationId = null;

// DOM元素
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');
const roomCodeInput = document.getElementById('roomCodeInput');
const nicknameInput = document.getElementById('nicknameInput');
const statusMsg = document.getElementById('statusMsg');
const displayRoomCode = document.getElementById('displayRoomCode');
const playersList = document.getElementById('playersList');
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas ? gameCanvas.getContext('2d') : null;
const localScoreEl = document.getElementById('localScore');
const opponentScoreEl = document.getElementById('opponentScore');
const difficultySelect = document.getElementById('difficultySelect');

// 难度配置
const difficultyConfig = {
  easy: { speed: 2, obstacleFreq: 0.02, coinFreq: 0.03 },
  normal: { speed: 3, obstacleFreq: 0.03, coinFreq: 0.04 },
  hard: { speed: 4, obstacleFreq: 0.04, coinFreq: 0.05 }
};

let currentDifficulty = 'normal';

// 初始化
function init() {
  setupEventListeners();
  showScreen('menu');

  // 检测 URL 参数，自动进入对应模式
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'solo') {
    setTimeout(() => startSoloMode(), 500);
  }
}

function setupEventListeners() {
  // 菜单按钮
  document.getElementById('createRoomBtn').addEventListener('click', createRoom);
  document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
  document.getElementById('copyRoomBtn').addEventListener('click', copyRoomCode);
  document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
  document.getElementById('restartGameBtn').addEventListener('click', requestRestart);
  document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
  
  // 难度选择
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      currentDifficulty = e.target.value;
    });
  }

  // 单人模式按钮
  const soloModeBtn = document.getElementById('soloModeBtn');
  if (soloModeBtn) soloModeBtn.addEventListener('click', startSoloMode);

  const soloQuitBtn = document.getElementById('soloQuitBtn');
  if (soloQuitBtn) soloQuitBtn.addEventListener('click', quitSoloMode);

  const soloNextRoundBtn = document.getElementById('soloNextRoundBtn');
  if (soloNextRoundBtn) soloNextRoundBtn.addEventListener('click', startSoloRound);

  const soloFinishBtn = document.getElementById('soloFinishBtn');
  if (soloFinishBtn) soloFinishBtn.addEventListener('click', finishSoloChallenge);

  // 键盘控制
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // 移动端触摸
  if (gameCanvas) {
    gameCanvas.addEventListener('touchstart', handleTouch);
  }
  
  // Socket事件
  setupSocketListeners();
}

function setupSocketListeners() {
  socket.on('connect', () => {
    console.log('已连接到服务器');
  });
  
  socket.on('disconnect', () => {
    console.log('已断开连接');
    showStatus('连接已断开');
  });
  
  socket.on('playerJoined', (data) => {
    updatePlayersList(data.players);
    showStatus(`${data.players.find(p => p.role !== currentPlayer)?.nickname || '对手'}已加入`);
  });
  
  socket.on('gameStarted', (data) => {
    gameState = data.gameState;
    startGame();
  });
  
  socket.on('opponentScoreUpdate', (data) => {
    opponentScore = data.score;
    updateScores();
  });
  
  socket.on('opponentGameOver', (data) => {
    opponentScore = data.score;
    opponentScoreEl.textContent = opponentScore;
  });
  
  socket.on('gameOver', (data) => {
    gameState = data.gameState;
    endGame();
  });
  
  socket.on('gameRestarted', (data) => {
    gameState = data.gameState;
    resetGameState();
    startGame();
  });
  
  socket.on('playerDisconnected', (data) => {
    showStatus(data.message);
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
  });
  
  socket.on('roomTimeout', (msg) => {
    showStatus(msg);
    backToMenu();
  });
}

// 菜单操作
function createRoom() {
  const nickname = nicknameInput?.value.trim() || '玩家1';
  const difficulty = currentDifficulty;
  
  socket.emit('createRoom', { nickname, difficulty }, (response) => {
    if (response.success) {
      currentRoom = response.roomCode;
      currentPlayer = response.playerRole;
      isHost = true;
      gameState = response.gameState;
      displayRoomCode.textContent = response.roomCode;
      updatePlayersList(response.players);
      showScreen('waiting');
      showStatus('等待对手加入...');
    } else {
      showStatus('创建房间失败');
    }
  });
}

function joinRoom() {
  const nickname = nicknameInput?.value.trim() || '玩家2';
  const roomCode = roomCodeInput?.value.trim().toUpperCase();
  
  if (!roomCode || roomCode.length !== 6) {
    showStatus('请输入6位房间码');
    return;
  }
  
  socket.emit('joinRoom', roomCode, { nickname }, (response) => {
    if (response.success) {
      currentRoom = response.roomCode;
      currentPlayer = response.playerRole;
      isHost = false;
      gameState = response.gameState;
      displayRoomCode.textContent = response.roomCode;
      updatePlayersList(response.players);
      showScreen('waiting');
      showStatus('已加入房间，等待开始...');
    } else {
      showStatus(response.reason || '加入房间失败');
    }
  });
}

function startGameRequest() {
  if (!isHost || gameState?.players?.length < 2) return;
  
  socket.emit('startGame', (response) => {
    if (response.success) {
      gameState = response.gameState;
      startGame();
    }
  });
}

function requestRestart() {
  socket.emit('restartGame', (response) => {
    if (response.success) {
      gameState = response.gameState;
      resetGameState();
      startGame();
    } else {
      showStatus(response.reason || '无法重新开始');
    }
  });
}

function leaveRoom() {
  socket.emit('leaveRoom');
  backToMenu();
}

function backToMenu() {
  currentRoom = null;
  currentPlayer = null;
  gameState = null;
  isHost = false;
  stopGame();
  showScreen('menu');
}

// UI更新
function showScreen(screen) {
  if (menuScreen) menuScreen.style.display = screen === 'menu' ? 'block' : 'none';
  if (document.getElementById('waitingScreen')) document.getElementById('waitingScreen').style.display = screen === 'waiting' ? 'block' : 'none';
  if (gameScreen) gameScreen.style.display = screen === 'game' ? 'block' : 'none';
  if (resultScreen) resultScreen.style.display = screen === 'result' ? 'block' : 'none';
}

function showStatus(msg) {
  if (statusMsg) statusMsg.textContent = msg;
}

function updatePlayersList(players) {
  if (!playersList) return;
  playersList.innerHTML = players.map(p => `
    <div class="player-item ${p.role === currentPlayer ? 'self' : ''}">
      <span class="player-name">${p.nickname}</span>
      <span class="player-role">${p.role === 'player1' ? '玩家1' : '玩家2'}</span>
      <span class="player-status">${p.isOnline ? '🟢' : '🔴'}</span>
    </div>
  `).join('');
  
  // 如果是主机且有2个玩家，显示开始按钮
  const startBtn = document.getElementById('startGameBtn');
  if (startBtn) {
    startBtn.style.display = (isHost && players.length >= 2) ? 'inline-block' : 'none';
  }
}

function updateScores() {
  if (localScoreEl) localScoreEl.textContent = localScore;
  if (opponentScoreEl) opponentScoreEl.textContent = opponentScore;
}

function copyRoomCode() {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom).then(() => {
    showStatus('房间码已复制');
  }).catch(() => {
    showStatus('复制失败，请手动复制');
  });
}

// 游戏逻辑
function startGame() {
  showScreen('game');
  resetGameState();
  
  const config = difficultyConfig[currentDifficulty] || difficultyConfig.normal;
  gameSpeed = config.speed;
  
  // 开始游戏循环
  gameLoop = setInterval(gameUpdate, 1000 / 60);
  requestAnimationId = requestAnimationFrame(render);
}

function stopGame() {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  if (requestAnimationId) {
    cancelAnimationFrame(requestAnimationId);
    requestAnimationId = null;
  }
  isGameOver = false;
}

function resetGameState() {
  localScore = 0;
  opponentScore = 0;
  playerY = 0;
  obstacles = [];
  coins = [];
  isJumping = false;
  jumpVelocity = 0;
  isGameOver = false;
  updateScores();
}

function gameUpdate() {
  if (isGameOver) return;
  
  // 更新玩家位置（自动跑酷）
  localScore++;
  localScoreEl.textContent = localScore;
  
  // 发送分数更新
  socket.emit('updateScore', localScore);
  
  // 生成障碍物
  if (Math.random() < (difficultyConfig[currentDifficulty]?.obstacleFreq || 0.03)) {
    obstacles.push({
      x: gameCanvas?.width || 500,
      y: (gameCanvas?.height || 400) - 40,
      width: 30,
      height: 40
    });
  }
  
  // 生成金币
  if (Math.random() < (difficultyConfig[currentDifficulty]?.coinFreq || 0.04)) {
    coins.push({
      x: gameCanvas?.width || 500,
      y: (gameCanvas?.height || 400) - 100 - Math.random() * 100,
      radius: 15,
      collected: false
    });
  }
  
  // 更新障碍物位置
  obstacles = obstacles.filter(obs => {
    obs.x -= gameSpeed;
    return obs.x > -obs.width;
  });
  
  // 更新金币位置
  coins = coins.filter(coin => {
    coin.x -= gameSpeed;
    if (!coin.collected && isCollidingWithPlayer(coin)) {
      coin.collected = true;
      localScore += 50;
    }
    return coin.x > -coin.radius;
  });
  
  // 跳跃物理
  if (isJumping) {
    jumpVelocity += 0.8; // 重力
    playerY += jumpVelocity;
    
    if (playerY >= 0) {
      playerY = 0;
      isJumping = false;
      jumpVelocity = 0;
    }
  }
  
  // 碰撞检测
  for (const obs of obstacles) {
    if (isColliding(obs)) {
      gameOver();
      return;
    }
  }
}

function isCollidingWithPlayer(obj) {
  if (!gameCanvas) return false;
  const playerX = 50;
  const playerY = (gameCanvas.height || 400) - 40 + this.playerY;
  const playerWidth = 40;
  const playerHeight = 40;
  
  if (obj.radius) {
    // 圆形（金币）
    const dx = playerX + playerWidth / 2 - obj.x;
    const dy = playerY + playerHeight / 2 - obj.y;
    return Math.sqrt(dx * dx + dy * dy) < obj.radius + 20;
  }
  
  return isColliding(obj);
}

function isColliding(obs) {
  if (!gameCanvas) return false;
  const playerX = 50;
  const playerY = (gameCanvas.height || 400) - 40 + playerY;
  const playerWidth = 40;
  const playerHeight = 40;
  
  return playerX < obs.x + obs.width &&
         playerX + playerWidth > obs.x &&
         playerY < obs.y + obs.height &&
         playerY + playerHeight > obs.y;
}

function gameOver() {
  isGameOver = true;
  stopGame();
  
  socket.emit('gameOver', localScore, (result) => {
    if (result.bothFinished) {
      gameState = result.gameState;
      showResult();
    }
  });
}

function endGame() {
  isGameOver = true;
  stopGame();
  showResult();
}

function showResult() {
  showScreen('result');
  
  const winner = gameState?.winner;
  const resultTitle = document.getElementById('resultTitle');
  const resultDetails = document.getElementById('resultDetails');
  
  const myScore = currentPlayer === 'player1' ? gameState?.players?.player1?.score : gameState?.players?.player2?.score;
  const oppScore = currentPlayer === 'player1' ? gameState?.players?.player2?.score : gameState?.players?.player1?.score;
  
  if (resultTitle) {
    if (winner === currentPlayer) {
      resultTitle.textContent = '🎉 获胜！';
    } else if (winner === 'draw') {
      resultTitle.textContent = '🤝 平局';
    } else {
      resultTitle.textContent = '😢 失败';
    }
  }
  
  if (resultDetails) {
    resultDetails.innerHTML = `
      <p>你的得分：${myScore}</p>
      <p>对手得分：${oppScore}</p>
    `;
  }

  // 提交到排行榜
  submitToLeaderboard(myScore);
}

async function submitToLeaderboard(score) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  try {
    await fetch('/api/leaderboard/8bit-arcade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        extra: { difficulty: currentDifficulty, mode: 'online' }
      })
    });
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}

function render() {
  if (!ctx || !gameCanvas) return;
  
  const canvas = gameCanvas;
  const ctx = ctx;
  
  // 清空画布
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 绘制背景
  drawBackground();
  
  // 绘制地面
  ctx.fillStyle = '#4a4a6a';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
  
  // 绘制玩家
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(50, canvas.height - 40 + playerY, 40, 40);
  
  // 绘制障碍物
  ctx.fillStyle = '#e74c3c';
  obstacles.forEach(obs => {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });
  
  // 绘制金币
  ctx.fillStyle = '#f1c40f';
  coins.forEach(coin => {
    if (!coin.collected) {
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // 继续渲染循环
  if (!isGameOver) {
    requestAnimationFrame(render);
  }
}

function drawBackground() {
  if (!ctx || !gameCanvas) return;
  
  // 简单的视差背景
  const time = Date.now() / 100;
  ctx.fillStyle = '#16213e';
  
  // 绘制移动的星星
  for (let i = 0; i < 20; i++) {
    const x = ((i * 50 + time * 2) % (gameCanvas.width + 50)) - 25;
    const y = (i * 37) % (gameCanvas.height - 60);
    ctx.fillRect(x, y, 3, 3);
  }
}

// 输入处理
function handleKeyDown(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (!isJumping && gameLoop) {
      jump();
    }
  }
}

function handleKeyUp(e) {
  // 可以添加其他按键释放处理
}

function handleTouch(e) {
  e.preventDefault();
  if (!isJumping && gameLoop) {
    jump();
  }
}

function jump() {
  if (!isJumping) {
    isJumping = true;
    jumpVelocity = -15;
  }
}

// 启动
document.addEventListener('DOMContentLoaded', init);

// 如果直接加载脚本
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
}

// ==================== 单人模式逻辑 ====================

let soloActive = false;
let soloRound = 1;
let soloScores = [];
let soloScore = 0;
let soloLoop = null;
let soloAnimId = null;
let soloPlayerY = 0;
let soloJumpVel = 0;
let soloIsJumping = false;
let soloObstacles = [];
let soloCoins = [];
let soloIsOver = false;
let soloCanvas, soloCtx;

function startSoloMode() {
  soloActive = true;
  soloRound = 1;
  soloScores = [];
  soloCanvas = document.getElementById('soloCanvas');
  soloCtx = soloCanvas ? soloCanvas.getContext('2d') : null;

  showSoloScreen('solo');
  startSoloRound();

  // 移动端触摸
  if (soloCanvas) {
    soloCanvas.addEventListener('touchstart', handleSoloTouch);
    soloCanvas.addEventListener('click', handleSoloClick);
  }
}

function quitSoloMode() {
  soloActive = false;
  stopSoloGame();
  showScreen('menu');
}

function startSoloRound() {
  soloScore = 0;
  soloPlayerY = 0;
  soloJumpVel = 0;
  soloIsJumping = false;
  soloObstacles = [];
  soloCoins = [];
  soloIsOver = false;

  const roundInfo = document.getElementById('soloRoundInfo');
  if (roundInfo) roundInfo.textContent = `第 ${soloRound}/3 局`;

  const config = difficultyConfig[currentDifficulty] || difficultyConfig.normal;
  gameSpeed = config.speed;

  stopSoloGame();
  soloLoop = setInterval(soloUpdate, 1000 / 60);
  soloAnimId = requestAnimationFrame(soloRender);
}

function stopSoloGame() {
  if (soloLoop) { clearInterval(soloLoop); soloLoop = null; }
  if (soloAnimId) { cancelAnimationFrame(soloAnimId); soloAnimId = null; }
}

function soloUpdate() {
  if (soloIsOver || !soloActive) return;

  soloScore++;
  const config = difficultyConfig[currentDifficulty] || difficultyConfig.normal;

  // 生成障碍物
  if (Math.random() < config.obstacleFreq) {
    soloObstacles.push({
      x: (soloCanvas?.width || 500),
      y: (soloCanvas?.height || 400) - 40,
      width: 30,
      height: 40
    });
  }

  // 生成金币
  if (Math.random() < config.coinFreq) {
    soloCoins.push({
      x: (soloCanvas?.width || 500),
      y: (soloCanvas?.height || 400) - 100 - Math.random() * 100,
      radius: 15,
      collected: false
    });
  }

  // 更新障碍物
  soloObstacles = soloObstacles.filter(obs => {
    obs.x -= gameSpeed;
    return obs.x > -obs.width;
  });

  // 更新金币
  soloCoins = soloCoins.filter(coin => {
    coin.x -= gameSpeed;
    if (!coin.collected && soloCheckCoinCollision(coin)) {
      coin.collected = true;
      soloScore += 50;
    }
    return coin.x > -coin.radius;
  });

  // 跳跃物理
  if (soloIsJumping) {
    soloJumpVel += 0.8;
    soloPlayerY += soloJumpVel;
    if (soloPlayerY >= 0) {
      soloPlayerY = 0;
      soloIsJumping = false;
      soloJumpVel = 0;
    }
  }

  // 碰撞检测
  for (const obs of soloObstacles) {
    if (soloCheckCollision(obs)) {
      soloGameOver();
      return;
    }
  }
}

function soloGameOver() {
  soloIsOver = true;
  stopSoloGame();

  soloScores.push(soloScore);
  const bestScore = Math.max(...soloScores);

  // 报告成绩
  window.reportChallengeScore && window.reportChallengeScore(soloScore);

  // 提交到排行榜
  submitToLeaderboardSolo(soloScore);

  // 若3局未满，自动进入下一局
  if (soloRound < 3) {
    soloRound++;
    showSoloScreen('soloResult');

    const resultDetails = document.getElementById('soloResultDetails');
    const resultTitle = document.getElementById('soloResultTitle');
    const bestScoreEl = document.getElementById('soloBestScore');

    if (resultTitle) resultTitle.textContent = `📊 第${soloRound - 1}局得分：${soloScore}`;
    if (resultDetails) resultDetails.innerHTML = `<p>本局得分：${soloScore}</p><p style="margin-top:10px;">${soloRound - 1 < 3 ? '即将进入第' + soloRound + '局...' : ''}</p>`;
    if (bestScoreEl) bestScoreEl.textContent = `当前最高分：${bestScore}（共${soloScores.length}局）`;

    setTimeout(() => {
      showSoloScreen('solo');
      startSoloRound();
    }, 2000);
  } else {
    showSoloScreen('soloResult');

    const resultDetails = document.getElementById('soloResultDetails');
    const resultTitle = document.getElementById('soloResultTitle');
    const bestScoreEl = document.getElementById('soloBestScore');

    if (resultTitle) resultTitle.textContent = `🏁 挑战完成！`;
    if (resultDetails) resultDetails.innerHTML = `<p>3局得分：${soloScores.join(' / ')}</p><p style="margin-top:10px;">最佳成绩：${bestScore}</p>`;
    if (bestScoreEl) bestScoreEl.textContent = `最终最高分：${bestScore}`;
  }
}

function finishSoloChallenge() {
  soloActive = false;
  const best = Math.max(...soloScores);
  const sessionId = localStorage.getItem('challengeSessionId');
  if (sessionId) {
    localStorage.removeItem('challengeSessionId');
    localStorage.removeItem('challengeGameId');
    localStorage.removeItem('challengeActivityId');
  }
  window.location.href = '/activity.html';
}

async function submitToLeaderboardSolo(score) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  try {
    await fetch('/api/leaderboard/8bit-arcade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        extra: { difficulty: currentDifficulty, mode: 'solo' }
      })
    });
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}

function soloRender() {
  if (!soloCtx || !soloCanvas || !soloActive) return;

  const canvas = soloCanvas;
  const ctx = soloCtx;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 背景星星
  const time = Date.now() / 100;
  ctx.fillStyle = '#16213e';
  for (let i = 0; i < 20; i++) {
    const x = ((i * 50 + time * 2) % (canvas.width + 50)) - 25;
    const y = (i * 37) % (canvas.height - 60);
    ctx.fillRect(x, y, 3, 3);
  }

  // 地面
  ctx.fillStyle = '#4a4a6a';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  // 玩家
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(50, canvas.height - 40 + soloPlayerY, 40, 40);

  // 障碍物
  ctx.fillStyle = '#e74c3c';
  soloObstacles.forEach(obs => {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });

  // 金币
  ctx.fillStyle = '#f1c40f';
  soloCoins.forEach(coin => {
    if (!coin.collected) {
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 当前分数
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial';
  ctx.fillText(`得分: ${soloScore}`, 10, 30);

  if (!soloIsOver && soloActive) {
    soloAnimId = requestAnimationFrame(soloRender);
  }
}

function soloCheckCollision(obs) {
  if (!soloCanvas) return false;
  const playerX = 50;
  const playerY = soloCanvas.height - 40 + soloPlayerY;
  return playerX < obs.x + obs.width &&
         playerX + 40 > obs.x &&
         playerY < obs.y + obs.height &&
         playerY + 40 > obs.y;
}

function soloCheckCoinCollision(coin) {
  if (!soloCanvas) return false;
  const playerX = 50;
  const playerY = soloCanvas.height - 40 + soloPlayerY;
  const dx = playerX + 20 - coin.x;
  const dy = playerY + 20 - coin.y;
  return Math.sqrt(dx * dx + dy * dy) < coin.radius + 20;
}

function soloJump() {
  if (!soloIsJumping && soloActive && !soloIsOver) {
    soloIsJumping = true;
    soloJumpVel = -15;
  }
}

function handleSoloTouch(e) {
  e.preventDefault();
  soloJump();
}

function handleSoloClick(e) {
  soloJump();
}

// 全局键盘支持跳跃
const origHandleKeyDown = handleKeyDown;
document.removeEventListener('keydown', handleKeyDown);
document.addEventListener('keydown', function(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (soloActive && !soloIsOver) {
      e.preventDefault();
      soloJump();
    } else {
      origHandleKeyDown(e);
    }
  }
});

function showSoloScreen(screen) {
  const soloScreen = document.getElementById('soloScreen');
  const soloResultScreen = document.getElementById('soloResultScreen');
  const menuScreenEl = document.getElementById('menuScreen');

  if (menuScreenEl) menuScreenEl.style.display = 'none';
  if (soloScreen) soloScreen.style.display = screen === 'solo' ? 'block' : 'none';
  if (soloResultScreen) soloResultScreen.style.display = screen === 'soloResult' ? 'block' : 'none';

  // 下一局按钮文字
  const nextBtn = document.getElementById('soloNextRoundBtn');
  if (nextBtn) {
    if (soloRound >= 3) {
      nextBtn.textContent = '已是最后一局';
      nextBtn.style.display = 'none';
    } else {
      nextBtn.textContent = `🔄 第${soloRound + 1}局`;
      nextBtn.style.display = 'inline-block';
    }
  }
}