/**
 * 8比特街机 - 经典像素跑酷联机对战
 * 物理逻辑移植自 legacy/8bit-arcade-oline.html
 * 联机沿用 server Socket 事件契约，单人模式随时重玩（不接活动系统）
 */

// ==================== 全局状态 ====================
const socket = io('/8bit-arcade');

let currentRoom = null;        // 房间码
let myRole = null;             // 'player1' | 'player2'
let currentDifficulty = 'normal';

// 联机游戏状态
let onlineRunning = false;
let onlineGameOver = false;
let onlineScore = 0;
let onlineAnimId = null;
let lastTime = 0;
let lastScoreSync = 0;

// 单人游戏状态（随时重玩，无局数限制）
let soloRunning = false;
let soloGameOver = false;
let soloScore = 0;
let soloAnimId = null;
let soloBest = parseInt(localStorage.getItem('8bit_bestScore') || '0', 10) || 0;

// ==================== 物理常量（移植自 legacy L1298-1347）====================
const difficulties = {
  easy:   { name: '简单', startSpeed: 2,   speedIncrement: 0.08, spawnRate: 180 },
  normal: { name: '中等', startSpeed: 3.5, speedIncrement: 0.15, spawnRate: 120 },
  hard:   { name: '困难', startSpeed: 5,   speedIncrement: 0.25, spawnRate: 80  }
};

const gravity = 0.6;
const jumpForce = -12;
const groundY = 260;
const moveSpeed = 5;

// 左右键状态（用于水平移动）
const keys = { left: false, right: false };

// 玩家对象（联机/单人共用结构，各维护一份实例）
function createPlayer() {
  return {
    x: 80, y: 200, width: 40, height: 60,
    velocityY: 0, jumping: false, grounded: true,
    ducking: false, jumpCount: 0, maxJumps: 2
  };
}

// ==================== DOM 引用 ====================
const $ = (id) => document.getElementById(id);
const screens = {
  menu: $('menuScreen'),
  waiting: $('waitingScreen'),
  game: $('gameScreen'),
  result: $('resultScreen'),
  solo: $('soloScreen'),
  soloResult: $('soloResultScreen')
};

const nicknameInput = $('nicknameInput');
const difficultySelect = $('difficultySelect');
const roomCodeInput = $('roomCodeInput');
const joinError = $('joinError');
const displayRoomCode = $('displayRoomCode');
const playersList = $('playersList');
const statusMsg = $('statusMsg');
const startGameBtn = $('startGameBtn');

const gameCanvas = $('gameCanvas');
const gameCtx = gameCanvas ? gameCanvas.getContext('2d') : null;
const localScoreEl = $('localScore');
const opponentScoreEl = $('opponentScore');

const soloCanvas = $('soloCanvas');
const soloCtx = soloCanvas ? soloCanvas.getContext('2d') : null;
const soloScoreEl = $('soloScore');
const soloBestEl = $('soloBest');

// ==================== 屏幕切换 ====================
function showScreen(name) {
  Object.values(screens).forEach(el => { if (el) el.classList.remove('active'); });
  if (screens[name]) screens[name].classList.add('active');
}

function showStatus(msg) { if (statusMsg) statusMsg.textContent = msg; }
function showJoinError(msg) { if (joinError) joinError.textContent = msg; }

function updatePlayersList(players) {
  if (!playersList) return;
  playersList.innerHTML = players.map(p => `
    <div class="player-item ${p.role === myRole ? 'self' : ''}">
      <span class="player-name">${p.nickname}</span>
      <span class="player-role">${p.role === 'player1' ? '玩家1（房主）' : '玩家2'}</span>
      <span>${p.isOnline ? '🟢' : '🔴'}</span>
    </div>
  `).join('');
  if (startGameBtn) {
    startGameBtn.style.display = (myRole === 'player1' && players.length >= 2) ? 'inline-block' : 'none';
  }
}

// ==================== 联机模式：Socket 事件 ====================
socket.on('connect', () => console.log('[8bit] 已连接服务器'));
socket.on('disconnect', () => showStatus('⚠️ 已断开连接'));

socket.on('playerJoined', (data) => {
  updatePlayersList(data.players);
  const opp = data.players.find(p => p.role !== myRole);
  showStatus(opp ? `${opp.nickname} 已加入，可以开始游戏` : '对手已加入');
});

socket.on('gameStarted', () => startOnlineGame());

socket.on('opponentScoreUpdate', (data) => {
  if (opponentScoreEl) opponentScoreEl.textContent = data.score;
});

socket.on('opponentGameOver', (data) => {
  if (opponentScoreEl) opponentScoreEl.textContent = data.score;
  if (!onlineGameOver) showStatus('对手已结束，继续加油！');
});

socket.on('gameOver', (data) => handleOnlineGameOver(data.gameState));

socket.on('gameRestarted', () => {
  resetOnlineState();
  startOnlineGame();
});

socket.on('playerDisconnected', (data) => {
  showStatus(`⚠️ ${data.message}，游戏暂停`);
  onlineRunning = false;
  stopOnlineLoop();
});

socket.on('roomTimeout', (msg) => {
  alert(msg);
  backToMenu();
});

socket.on('connect_error', () => showJoinError('连接服务器失败'));

// ==================== 联机模式：房间操作 ====================
function createRoom() {
  const nickname = (nicknameInput.value || '').trim() || '玩家1';
  const difficulty = difficultySelect.value;
  socket.emit('createRoom', { nickname, difficulty }, (res) => {
    if (res.success) {
      currentRoom = res.roomCode;
      myRole = res.playerRole;
      currentDifficulty = res.difficulty || difficulty;
      displayRoomCode.textContent = res.roomCode;
      updatePlayersList(res.players);
      showScreen('waiting');
      showStatus('等待对手加入...');
    } else {
      showJoinError('创建房间失败');
    }
  });
}

function joinRoom() {
  const nickname = (nicknameInput.value || '').trim() || '玩家2';
  const code = (roomCodeInput.value || '').trim().toUpperCase();
  if (!code || code.length !== 6) { showJoinError('请输入6位房间码'); return; }
  showJoinError('');
  socket.emit('joinRoom', code, { nickname }, (res) => {
    if (res.success) {
      currentRoom = res.roomCode;
      myRole = res.playerRole;
      currentDifficulty = res.difficulty || difficultySelect.value;
      displayRoomCode.textContent = res.roomCode;
      updatePlayersList(res.players);
      showScreen('waiting');
      showStatus('已加入，等待房主开始游戏...');
    } else {
      showJoinError(res.reason || '加入房间失败');
    }
  });
}

function requestStartGame() {
  socket.emit('startGame', (res) => {
    if (!res.success) showStatus(res.reason || '无法开始');
  });
}

function requestRestart() {
  socket.emit('restartGame', (res) => {
    if (!res.success) showStatus(res.reason || '无法重新开始');
  });
}

function leaveRoom() {
  socket.emit('leaveRoom');
  backToMenu();
}

function copyRoomCode() {
  if (!currentRoom) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentRoom).then(() => showStatus('房间码已复制')).catch(() => showStatus('复制失败，请手动复制'));
  } else {
    showStatus('请手动复制：' + currentRoom);
  }
}

function backToMenu() {
  currentRoom = null;
  myRole = null;
  onlineRunning = false;
  onlineGameOver = false;
  stopOnlineLoop();
  resetOnlineState();
  showScreen('menu');
}

// ==================== 联机模式：游戏循环（移植 legacy update L1516-1590）====================
let onlinePlayer, onlineObstacles, onlineClouds, onlineFrameCount, onlineGameSpeed;

function initOnlineState() {
  onlinePlayer = createPlayer();
  onlineObstacles = [];
  onlineClouds = [
    { x: 100, y: 40, size: 30, speed: 0.5 },
    { x: 300, y: 70, size: 25, speed: 0.7 },
    { x: 450, y: 30, size: 35, speed: 0.4 }
  ];
  onlineFrameCount = 0;
  onlineGameSpeed = difficulties[currentDifficulty].startSpeed;
  onlineScore = 0;
  lastTime = 0;
  lastScoreSync = Date.now();
  if (localScoreEl) localScoreEl.textContent = '0';
  if (opponentScoreEl) opponentScoreEl.textContent = '0';
}

function resetOnlineState() {
  onlineRunning = false;
  onlineGameOver = false;
  onlineScore = 0;
  if (localScoreEl) localScoreEl.textContent = '0';
}

function startOnlineGame() {
  showScreen('game');
  initOnlineState();
  onlineRunning = true;
  onlineGameOver = false;
  lastTime = 0;
  stopOnlineLoop();
  onlineAnimId = requestAnimationFrame(onlineLoop);
}

function stopOnlineLoop() {
  if (onlineAnimId) { cancelAnimationFrame(onlineAnimId); onlineAnimId = null; }
}

function onlineLoop(currentTime) {
  if (!onlineRunning) return;
  updateOnline(currentTime);
  drawScene(gameCtx, gameCanvas, onlinePlayer, onlineObstacles, onlineClouds, onlineFrameCount, onlineGameSpeed);
  onlineAnimId = requestAnimationFrame(onlineLoop);
}

function updateOnline(currentTime) {
  if (!onlineRunning || onlineGameOver) return;
  const dt = computeDeltaTime(currentTime);
  const diff = difficulties[currentDifficulty];

  onlineFrameCount++;
  onlineScore = Math.floor(onlineFrameCount / 10);
  if (localScoreEl) localScoreEl.textContent = onlineScore;

  // 每秒同步一次得分（非每帧，减少流量）
  const now = Date.now();
  if (now - lastScoreSync > 1000) {
    socket.emit('updateScore', onlineScore);
    lastScoreSync = now;
  }

  // 每 150 分加速一次
  if (onlineScore > 0 && onlineScore % 150 === 0) {
    onlineGameSpeed += diff.speedIncrement;
  }

  // 重力与跳跃
  onlinePlayer.velocityY += gravity * dt;
  onlinePlayer.y += onlinePlayer.velocityY * dt;
  if (onlinePlayer.y >= groundY - onlinePlayer.height) {
    onlinePlayer.y = groundY - onlinePlayer.height;
    onlinePlayer.velocityY = 0;
    onlinePlayer.jumping = false;
    onlinePlayer.grounded = true;
    onlinePlayer.jumpCount = 0;
  }

  // 左右移动（带边界限制）
  updateHorizontal(onlinePlayer, gameCanvas, dt);

  // 障碍生成（移植 legacy L1562-1568）
  const spawnInterval = Math.max(diff.spawnRate - Math.floor(onlineGameSpeed * 3), 40);
  if (onlineFrameCount % Math.max(1, Math.floor(spawnInterval / dt)) === 0) {
    if (Math.random() > 0.4) spawnObstacle(onlineObstacles, gameCanvas);
  }

  // 障碍移动与清理
  onlineObstacles.forEach((obs, idx) => {
    obs.x -= onlineGameSpeed * dt;
    if (obs.x + obs.width < 0) onlineObstacles.splice(idx, 1);
  });

  // 云朵移动（循环）
  onlineClouds.forEach(cloud => {
    cloud.x -= cloud.speed * dt;
    if (cloud.x + cloud.size < 0) {
      cloud.x = gameCanvas.width + cloud.size;
      cloud.y = Math.random() * 80 + 20;
    }
  });

  // 碰撞检测
  for (const obs of onlineObstacles) {
    if (checkCollision(onlinePlayer, obs)) { endOnlineGame(); return; }
  }
}

function endOnlineGame() {
  onlineGameOver = true;
  onlineRunning = false;
  stopOnlineLoop();
  socket.emit('gameOver', onlineScore, (res) => {
    if (res.success && res.bothFinished) handleOnlineGameOver(res.gameState);
    else showStatus('已结束，等待对手完成...');
  });
  submitScoreToLeaderboard(onlineScore, 'online');
}

function handleOnlineGameOver(gameState) {
  onlineRunning = false;
  onlineGameOver = true;
  stopOnlineLoop();
  showScreen('result');

  const winner = gameState.winner;
  const myScore = gameState.players[myRole].score;
  const oppScore = gameState.players[myRole === 'player1' ? 'player2' : 'player1'].score;

  const titleEl = $('resultTitle');
  const detailsEl = $('resultDetails');
  if (winner === myRole) {
    titleEl.textContent = '🎉 获胜！';
  } else if (winner === 'draw') {
    titleEl.textContent = '🤝 平局';
  } else {
    titleEl.textContent = '😢 失败';
  }
  detailsEl.innerHTML = `<p>你的得分：${myScore}</p><p>对手得分：${oppScore}</p>`;
  // 仅房主可发起重开
  $('restartGameBtn').style.display = myRole === 'player1' ? 'inline-block' : 'none';
}

// ==================== 单人模式（随时重玩，不接活动系统）====================
let soloPlayer, soloObstacles, soloClouds, soloFrameCount, soloGameSpeed;

function initSoloState() {
  soloPlayer = createPlayer();
  soloObstacles = [];
  soloClouds = [
    { x: 100, y: 40, size: 30, speed: 0.5 },
    { x: 300, y: 70, size: 25, speed: 0.7 },
    { x: 450, y: 30, size: 35, speed: 0.4 }
  ];
  soloFrameCount = 0;
  soloGameSpeed = difficulties[currentDifficulty].startSpeed;
  soloScore = 0;
  lastTime = 0;
  if (soloScoreEl) soloScoreEl.textContent = '0';
  if (soloBestEl) soloBestEl.textContent = soloBest;
}

function startSoloMode() {
  // 读取菜单难度
  currentDifficulty = difficultySelect.value;
  showScreen('solo');
  initSoloState();
  soloRunning = true;
  soloGameOver = false;
  lastTime = 0;
  stopSoloLoop();
  soloAnimId = requestAnimationFrame(soloLoop);
}

function stopSoloLoop() {
  if (soloAnimId) { cancelAnimationFrame(soloAnimId); soloAnimId = null; }
}

function soloLoop(currentTime) {
  if (!soloRunning) return;
  updateSolo(currentTime);
  drawScene(soloCtx, soloCanvas, soloPlayer, soloObstacles, soloClouds, soloFrameCount, soloGameSpeed);
  soloAnimId = requestAnimationFrame(soloLoop);
}

function updateSolo(currentTime) {
  if (!soloRunning || soloGameOver) return;
  const dt = computeDeltaTime(currentTime);
  const diff = difficulties[currentDifficulty];

  soloFrameCount++;
  soloScore = Math.floor(soloFrameCount / 10);
  if (soloScoreEl) soloScoreEl.textContent = soloScore;

  if (soloScore > 0 && soloScore % 150 === 0) {
    soloGameSpeed += diff.speedIncrement;
  }

  soloPlayer.velocityY += gravity * dt;
  soloPlayer.y += soloPlayer.velocityY * dt;
  if (soloPlayer.y >= groundY - soloPlayer.height) {
    soloPlayer.y = groundY - soloPlayer.height;
    soloPlayer.velocityY = 0;
    soloPlayer.jumping = false;
    soloPlayer.grounded = true;
    soloPlayer.jumpCount = 0;
  }

  // 左右移动（带边界限制）
  updateHorizontal(soloPlayer, soloCanvas, dt);

  const spawnInterval = Math.max(diff.spawnRate - Math.floor(soloGameSpeed * 3), 40);
  if (soloFrameCount % Math.max(1, Math.floor(spawnInterval / dt)) === 0) {
    if (Math.random() > 0.4) spawnObstacle(soloObstacles, soloCanvas);
  }

  soloObstacles.forEach((obs, idx) => {
    obs.x -= soloGameSpeed * dt;
    if (obs.x + obs.width < 0) soloObstacles.splice(idx, 1);
  });

  soloClouds.forEach(cloud => {
    cloud.x -= cloud.speed * dt;
    if (cloud.x + cloud.size < 0) {
      cloud.x = soloCanvas.width + cloud.size;
      cloud.y = Math.random() * 80 + 20;
    }
  });

  for (const obs of soloObstacles) {
    if (checkCollision(soloPlayer, obs)) { endSoloGame(); return; }
  }
}

function endSoloGame() {
  soloGameOver = true;
  soloRunning = false;
  stopSoloLoop();

  // 更新历史最高
  if (soloScore > soloBest) {
    soloBest = soloScore;
    localStorage.setItem('8bit_bestScore', String(soloBest));
  }

  // 提交排行榜
  submitScoreToLeaderboard(soloScore, 'solo');

  // 显示结果（随时重玩，不跳转活动页）
  showScreen('soloResult');
  $('soloResultTitle').textContent = '🏁 本局结束';
  $('soloResultDetails').innerHTML = `
    <p>本局得分：${soloScore}</p>
    <p>历史最高：${soloBest}</p>
  `;
}

function quitSolo() {
  soloRunning = false;
  soloGameOver = false;
  stopSoloLoop();
  showScreen('menu');
}

function retrySolo() {
  // 随时重玩：重新初始化并开始
  startSoloMode();
}

// ==================== 共用：deltaTime 计算（移植 legacy L1519-1530）====================
function computeDeltaTime(currentTime) {
  if (!currentTime || isNaN(currentTime)) currentTime = performance.now();
  if (!lastTime || isNaN(lastTime)) lastTime = currentTime;
  let dt = (currentTime - lastTime) / 16.67;
  if (isNaN(dt) || dt <= 0 || dt > 5) dt = 1;
  lastTime = currentTime;
  return dt;
}

// ==================== 共用：障碍生成（移植 legacy spawnObstacle L1467-1514）====================
function spawnObstacle(obstacles, canvas) {
  const types = ['ground_small', 'ground_medium', 'ground_large', 'flying'];
  const weights = [0.3, 0.3, 0.2, 0.2];
  let random = Math.random();
  let type = types[0];
  let cumulative = 0;
  for (let i = 0; i < types.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) { type = types[i]; break; }
  }
  let width, height, y;
  switch (type) {
    case 'ground_small':  width = 20; height = 35; y = groundY - height; break;
    case 'ground_medium': width = 30; height = 45; y = groundY - height; break;
    case 'ground_large':  width = 40; height = 55; y = groundY - height; break;
    case 'flying':        width = 40; height = 25; y = groundY - 80;      break;
  }
  obstacles.push({ x: canvas.width, y, width, height, type });
}

// ==================== 共用：碰撞检测（移植 legacy checkCollision L1592-1598）====================
function checkCollision(a, b) {
  const padding = 5;
  return a.x + padding < b.x + b.width &&
         a.x + a.width - padding > b.x &&
         a.y + padding < b.y + b.height &&
         a.y + a.height - padding > b.y;
}

// ==================== 共用：左右移动（横轴位移，带边界限制）====================
function updateHorizontal(player, canvas, dt) {
  if (keys.left) player.x = Math.max(0, player.x - moveSpeed * dt);
  if (keys.right) player.x = Math.min(canvas.width - player.width, player.x + moveSpeed * dt);
}

// ==================== 共用：跳跃与下蹲（移植 legacy L1439-1465，修复 jump 未重置 y 的 bug）====================
function jump(player, running, gameOverFlag) {
  if (!running || gameOverFlag) return;
  if (player.jumpCount < player.maxJumps) {
    // 仅在下蹲状态起跳时才恢复高度并对齐 y，避免破坏二段跳的空中连续性
    if (player.ducking) {
      player.height = 60;
      player.y = groundY - player.height;
    }
    player.velocityY = jumpForce;
    player.jumping = true;
    player.grounded = false;
    player.ducking = false;
    player.jumpCount++;
  }
}

function duck(player, running, gameOverFlag, isDucking) {
  if (!running || gameOverFlag) return;
  if (isDucking && player.grounded) {
    player.ducking = true;
    player.height = 30;
    player.y = groundY - player.height;
  } else if (!isDucking) {
    player.ducking = false;
    player.height = 60;
    player.y = groundY - player.height;
  }
}

// ==================== 共用：渲染（移植 legacy draw L1648-1779）====================
function drawScene(ctx, canvas, player, obstacles, clouds, frameCount, gameSpeed) {
  if (!ctx || !canvas) return;

  // 背景
  ctx.fillStyle = '#0f0f23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 云朵
  clouds.forEach(cloud => drawCloud(ctx, cloud.x, cloud.y, cloud.size));

  // 地面线 + 滚动网格
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(0, groundY, canvas.width, 2);
  for (let i = 0; i < canvas.width; i += 20) {
    ctx.fillRect(i + (frameCount * gameSpeed) % 20, groundY + 5, 10, 2);
  }

  // 玩家
  drawPlayer(ctx, player, frameCount);

  // 障碍物
  obstacles.forEach(obs => {
    if (obs.type === 'flying') drawBird(ctx, obs.x, obs.y, obs.width, obs.height, frameCount);
    else drawCactus(ctx, obs.x, obs.y, obs.width, obs.height);
  });
}

function drawCloud(ctx, x, y, size) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, player, frameCount) {
  const x = Math.floor(player.x);
  const y = Math.floor(player.y);
  const w = player.width;
  const h = player.height;

  if (player.ducking) {
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x + 4, y + 8, w - 8, h - 12);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x + 2, y, w - 4, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 6, 6, 6);
    ctx.fillRect(x + w - 14, y + 6, 6, 6);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 10, y + 8, 3, 3);
    ctx.fillRect(x + w - 12, y + 8, 3, 3);
  } else {
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x + 5, y + 15, w - 10, h - 25);
    ctx.fillRect(x + 3, y + 5, w - 6, 15);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(x, y, w, 8);
    ctx.fillRect(x + 5, y - 3, w - 10, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 10, 7, 7);
    ctx.fillRect(x + w - 15, y + 10, 7, 7);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 11, y + 12, 3, 3);
    ctx.fillRect(x + w - 13, y + 12, 3, 3);
    // 腿部动画（每4帧切换）
    ctx.fillStyle = '#333333';
    if (player.grounded) {
      const legPhase = Math.floor(frameCount / 4) % 2;
      if (legPhase === 0) {
        ctx.fillRect(x + 6, y + h - 12, 8, 12);
        ctx.fillRect(x + w - 14, y + h - 8, 8, 8);
      } else {
        ctx.fillRect(x + 6, y + h - 8, 8, 8);
        ctx.fillRect(x + w - 14, y + h - 12, 8, 12);
      }
    } else {
      ctx.fillRect(x + 6, y + h - 10, 8, 10);
      ctx.fillRect(x + w - 14, y + h - 10, 8, 10);
    }
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y + 18, 5, 15);
    ctx.fillRect(x + w - 5, y + 18, 5, 15);
  }
}

function drawCactus(ctx, x, y, w, h) {
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(x + w * 0.3, y, w * 0.4, h);
  ctx.fillRect(x, y + h * 0.3, w * 0.3, h * 0.15);
  ctx.fillRect(x, y + h * 0.3, w * 0.15, h * 0.4);
  ctx.fillRect(x + w * 0.7, y + h * 0.5, w * 0.3, h * 0.15);
  ctx.fillRect(x + w * 0.85, y + h * 0.2, w * 0.15, h * 0.45);
  ctx.fillStyle = '#2e7d32';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + w * 0.35, y + i * (h / 5) + 5, 2, 2);
    ctx.fillRect(x + w * 0.55, y + i * (h / 5) + 10, 2, 2);
  }
}

function drawBird(ctx, x, y, w, h, frameCount) {
  ctx.fillStyle = '#9c27b0';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // 翅膀振动
  const wingOffset = Math.sin(frameCount * 0.3) * 5;
  ctx.fillStyle = '#7b1fa2';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.5);
  ctx.lineTo(x - 5, y + h * 0.3 + wingOffset);
  ctx.lineTo(x + w * 0.3, y + h * 0.7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h * 0.4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x + w * 0.75, y + h * 0.4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(x + w, y + h * 0.5);
  ctx.lineTo(x + w + 8, y + h * 0.4);
  ctx.lineTo(x + w + 8, y + h * 0.6);
  ctx.fill();
}

// ==================== 排行榜提交 ====================
async function submitScoreToLeaderboard(score, mode) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  try {
    await fetch('/api/leaderboard/8bit-arcade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        extra: { difficulty: currentDifficulty, mode }
      })
    });
  } catch (e) {
    console.warn('[8bit] 排行榜提交失败:', e);
  }
}

// ==================== 排行榜弹窗（顶部按钮触发）====================
function showLeaderboard() {
  const modal = document.getElementById('leaderboardModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadLeaderboard();
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.classList.add('hidden');
}

async function loadLeaderboard(difficulty) {
  const listEl = document.getElementById('lbList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lb-empty"><div class="lb-empty-icon">⏳</div><p>加载中...</p></div>';
  try {
    const url = '/api/leaderboard/8bit-arcade' + (difficulty ? `?difficulty=${difficulty}` : '');
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.leaderboard && data.leaderboard.length > 0) {
      listEl.innerHTML = data.leaderboard.map((item, idx) => {
        const rankCls = idx < 3 ? `rank-${idx + 1}` : '';
        return `
          <div class="lb-item ${rankCls}">
            <div class="lb-rank">${idx + 1}</div>
            <div class="lb-name">${escapeHtmlText(item.nickname)}</div>
            <div class="lb-score">${item.score}<span class="lb-unit">${data.config.unit}</span></div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = '<div class="lb-empty"><div class="lb-empty-icon">🎯</div><p>暂无排行记录</p><p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p></div>';
    }
  } catch (e) {
    listEl.innerHTML = '<div class="lb-empty"><div class="lb-empty-icon">❌</div><p>加载失败</p><p style="font-size:12px;margin-top:5px;">请确保服务器已启动</p></div>';
  }
}

function escapeHtmlText(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// ==================== 事件绑定 ====================
function bindEvents() {
  $('createRoomBtn').addEventListener('click', createRoom);
  $('joinRoomBtn').addEventListener('click', joinRoom);
  $('copyRoomBtn').addEventListener('click', copyRoomCode);
  $('leaveRoomBtn').addEventListener('click', leaveRoom);
  $('startGameBtn').addEventListener('click', requestStartGame);
  $('backToMenuBtn').addEventListener('click', backToMenu);
  $('restartGameBtn').addEventListener('click', requestRestart);
  $('backToMenuFromResultBtn').addEventListener('click', backToMenu);

  $('soloModeBtn').addEventListener('click', startSoloMode);
  $('soloQuitBtn').addEventListener('click', quitSolo);
  $('soloRetryBtn').addEventListener('click', retrySolo);
  $('soloBackBtn').addEventListener('click', quitSolo);

  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => { currentDifficulty = e.target.value; });
  }

  // 键盘控制（联机 + 单人共用，根据当前激活屏幕分发）
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (soloRunning && !soloGameOver) {
        jump(soloPlayer, soloRunning, soloGameOver);
      } else if (onlineRunning && !onlineGameOver) {
        jump(onlinePlayer, onlineRunning, onlineGameOver);
      }
    }
    if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      if (soloRunning && !soloGameOver) {
        duck(soloPlayer, soloRunning, soloGameOver, true);
      } else if (onlineRunning && !onlineGameOver) {
        duck(onlinePlayer, onlineRunning, onlineGameOver, true);
      }
    }
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      keys.left = true;
    }
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      keys.right = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      if (soloRunning && !soloGameOver) {
        duck(soloPlayer, soloRunning, soloGameOver, false);
      } else if (onlineRunning && !onlineGameOver) {
        duck(onlinePlayer, onlineRunning, onlineGameOver, false);
      }
    }
    if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  // 联机 canvas 触屏/点击跳跃
  if (gameCanvas) {
    gameCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (onlineRunning && !onlineGameOver) jump(onlinePlayer, onlineRunning, onlineGameOver);
    });
    gameCanvas.addEventListener('click', () => {
      if (onlineRunning && !onlineGameOver) jump(onlinePlayer, onlineRunning, onlineGameOver);
    });
  }

  // 单人 canvas 触屏/点击跳跃
  if (soloCanvas) {
    soloCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (soloRunning && !soloGameOver) jump(soloPlayer, soloRunning, soloGameOver);
    });
    soloCanvas.addEventListener('click', () => {
      if (soloRunning && !soloGameOver) jump(soloPlayer, soloRunning, soloGameOver);
    });
  }

  // 移动端按钮
  const jumpBtn = $('jumpBtn');
  const duckBtn = $('duckBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (onlineRunning && !onlineGameOver) jump(onlinePlayer, onlineRunning, onlineGameOver);
    });
    jumpBtn.addEventListener('click', () => {
      if (onlineRunning && !onlineGameOver) jump(onlinePlayer, onlineRunning, onlineGameOver);
    });
  }
  if (duckBtn) {
    duckBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (onlineRunning && !onlineGameOver) duck(onlinePlayer, onlineRunning, onlineGameOver, true); });
    duckBtn.addEventListener('touchend', (e) => { e.preventDefault(); if (onlineRunning && !onlineGameOver) duck(onlinePlayer, onlineRunning, onlineGameOver, false); });
  }

  const sJumpBtn = $('soloJumpBtn');
  const sDuckBtn = $('soloDuckBtn');
  if (sJumpBtn) {
    sJumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (soloRunning && !soloGameOver) jump(soloPlayer, soloRunning, soloGameOver);
    });
    sJumpBtn.addEventListener('click', () => {
      if (soloRunning && !soloGameOver) jump(soloPlayer, soloRunning, soloGameOver);
    });
  }
  if (sDuckBtn) {
    sDuckBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (soloRunning && !soloGameOver) duck(soloPlayer, soloRunning, soloGameOver, true); });
    sDuckBtn.addEventListener('touchend', (e) => { e.preventDefault(); if (soloRunning && !soloGameOver) duck(soloPlayer, soloRunning, soloGameOver, false); });
  }

  // 回车键加入房间
  if (roomCodeInput) {
    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') joinRoom();
    });
  }
}

// ==================== 初始化 ====================
function init() {
  bindEvents();
  showScreen('menu');
  if (soloBestEl) soloBestEl.textContent = soloBest;
  // 恢复昵称
  const savedNick = localStorage.getItem('gameNickname');
  if (savedNick && nicknameInput) nicknameInput.value = savedNick;
  if (nicknameInput) {
    nicknameInput.addEventListener('change', () => {
      const v = nicknameInput.value.trim();
      if (v) localStorage.setItem('gameNickname', v);
    });
  }
  // 排行榜 modal 点击外部关闭
  const lbModal = document.getElementById('leaderboardModal');
  if (lbModal) {
    lbModal.addEventListener('click', (e) => {
      if (e.target === lbModal) closeLeaderboard();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
