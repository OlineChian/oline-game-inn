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
    const myScore = currentPlayer === 'player1' ? gameState?.players?.player1?.score : gameState?.players?.player2?.score;
    const oppScore = currentPlayer === 'player1' ? gameState?.players?.player2?.score : gameState?.players?.player1?.score;
    resultDetails.innerHTML = `
      <p>你的得分：${myScore}</p>
      <p>对手得分：${oppScore}</p>
    `;
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