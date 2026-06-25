/**
 * 罗莎琥珀好姐妹 - 终极井字棋
 * 客户端
 */

const socket = io('/rosa-ember');

// 游戏状态
let currentRoom = null;
let currentSymbol = null;
let gameState = null;
let isHost = false;

// DOM
const menuScreen = document.getElementById('menuScreen');
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');
const roomCodeInput = document.getElementById('roomCodeInput');
const nicknameInput = document.getElementById('nicknameInput');
const statusMsg = document.getElementById('statusMsg');
const displayRoomCode = document.getElementById('displayRoomCode');
const playersList = document.getElementById('playersList');
const globalBoard = document.getElementById('globalBoard');
const turnIndicator = document.getElementById('turnIndicator');
const resultTitle = document.getElementById('resultTitle');
const resultDetails = document.getElementById('resultDetails');

// 初始化
function init() {
  setupListeners();
  showScreen('menu');
}

function setupListeners() {
  document.getElementById('createRoomBtn').addEventListener('click', createRoom);
  document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
  document.getElementById('copyRoomBtn').addEventListener('click', copyRoomCode);
  document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
  document.getElementById('backBtn').addEventListener('click', () => showScreen('menu'));
  document.getElementById('restartBtn').addEventListener('click', restartGame);
  
  setupSocketListeners();
}

function setupSocketListeners() {
  socket.on('connect', () => console.log('已连接'));
  socket.on('disconnect', () => showStatus('连接断开'));
  
  socket.on('gameStart', (data) => {
    gameState = data.gameState;
    renderBoard();
    updateTurn();
    showScreen('game');
  });
  
  socket.on('gameStateUpdate', (data) => {
    gameState = data.gameState;
    renderBoard();
    updateTurn();
  });
  
  socket.on('gameOver', (data) => {
    gameState = data.gameState;
    renderBoard();
    showResult();
  });
  
  socket.on('gameRestarted', (data) => {
    gameState = data.gameState;
    renderBoard();
    updateTurn();
    showScreen('game');
  });
  
  socket.on('playerDisconnected', (data) => {
    showStatus(data.message);
  });
  
  socket.on('roomTimeout', (msg) => {
    showStatus(msg);
    showScreen('menu');
  });
}

// 菜单操作
function createRoom() {
  socket.emit('createRoom', (response) => {
    if (response.success) {
      currentRoom = response.roomCode;
      currentSymbol = response.playerSymbol;
      isHost = true;
      gameState = response.gameState;
      displayRoomCode.textContent = response.roomCode;
      updatePlayersList(response.players);
      showScreen('waiting');
      showStatus('等待对手加入...');
    }
  });
}

function joinRoom() {
  const code = roomCodeInput?.value.trim().toUpperCase();
  if (!code || code.length !== 6) {
    showStatus('请输入6位房间码');
    return;
  }
  
  socket.emit('joinRoom', code, (response) => {
    if (response.success) {
      currentRoom = response.roomCode;
      currentSymbol = response.playerSymbol;
      isHost = false;
      gameState = response.gameState;
      displayRoomCode.textContent = response.roomCode;
      updatePlayersList(response.players);
      renderBoard();
      updateTurn();
      showScreen('game');
    } else {
      showStatus(response.reason || '加入失败');
    }
  });
}

function leaveRoom() {
  currentRoom = null;
  currentSymbol = null;
  gameState = null;
  showScreen('menu');
}

function restartGame() {
  socket.emit('restartGame', (response) => {
    if (response.success) {
      gameState = response.gameState;
      renderBoard();
      updateTurn();
      showScreen('game');
    }
  });
}

function copyRoomCode() {
  if (!currentRoom) return;
  navigator.clipboard.writeText(currentRoom).then(() => {
    showStatus('已复制');
  });
}

// UI更新
function showScreen(screen) {
  menuScreen.style.display = screen === 'menu' ? 'block' : 'none';
  waitingScreen.style.display = screen === 'waiting' ? 'block' : 'none';
  gameScreen.style.display = screen === 'game' ? 'block' : 'none';
  resultScreen.style.display = screen === 'result' ? 'block' : 'none';
}

function showStatus(msg) {
  if (statusMsg) statusMsg.textContent = msg;
}

function updatePlayersList(players) {
  if (!playersList) return;
  playersList.innerHTML = players.map(p => `
    <div class="player-item ${p.symbol === currentSymbol ? 'self' : ''}">
      <span class="player-name">${p.name}</span>
      <span class="player-symbol">${p.symbol === 'rosa' ? '🌿' : '🔥'}</span>
      <span>${p.isOnline ? '🟢' : '🔴'}</span>
    </div>
  `).join('');
}

function updateTurn() {
  if (!gameState || !turnIndicator) return;
  
  const isMyTurn = gameState.currentPlayer === currentSymbol;
  const symbolName = gameState.currentPlayer === 'rosa' ? '罗莎' : '琥珀';
  
  turnIndicator.innerHTML = isMyTurn 
    ? `<span class="${gameState.currentPlayer}">你的回合 (${symbolName})</span>`
    : `等待对手... (${symbolName})`;
  turnIndicator.className = `turn-indicator turn-${gameState.currentPlayer}`;
}

// 棋盘渲染
function renderBoard() {
  if (!globalBoard || !gameState) return;
  
  globalBoard.innerHTML = '';
  
  for (let bi = 0; bi < 9; bi++) {
    const miniBoard = document.createElement('div');
    miniBoard.className = 'mini-board';
    miniBoard.dataset.boardIndex = bi;
    
    // 检查是否可点击
    const isActive = gameState.activeBoard === null || gameState.activeBoard === bi;
    const hasWinner = gameState.boardWinners[bi] !== null;
    
    if (!isActive || hasWinner || gameState.gameOver) {
      miniBoard.classList.add('disabled');
    }
    
    if (gameState.boardWinners[bi] === 'rosa') {
      miniBoard.classList.add('winner-rosa');
    } else if (gameState.boardWinners[bi] === 'amber') {
      miniBoard.classList.add('winner-amber');
    }
    
    // 渲染9个格子
    for (let ci = 0; ci < 9; ci++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.boardIndex = bi;
      cell.dataset.cellIndex = ci;
      
      const value = gameState.boardData[bi][ci];
      if (value === 'rosa') {
        cell.textContent = '🌿';
        cell.classList.add('rosa', 'taken');
      } else if (value === 'amber') {
        cell.textContent = '🔥';
        cell.classList.add('amber', 'taken');
      }
      
      // 点击事件
      if (isActive && !hasWinner && !value && !gameState.gameOver) {
        cell.addEventListener('click', () => makeMove(bi, ci));
      } else {
        cell.classList.add('taken');
      }
      
      miniBoard.appendChild(cell);
    }
    
    globalBoard.appendChild(miniBoard);
  }
}

function makeMove(boardIndex, cellIndex) {
  if (!gameState || gameState.gameOver) return;
  if (gameState.currentPlayer !== currentSymbol) return;
  
  const isActive = gameState.activeBoard === null || gameState.activeBoard === boardIndex;
  if (!isActive) return;
  
  socket.emit('makeMove', { boardIndex, cellIndex }, (response) => {
    if (!response.success) {
      console.log('移动失败:', response.reason);
    }
  });
}

function showResult() {
  showScreen('result');
  
  if (!gameState) return;
  
  const winner = gameState.winner;
  
  if (winner === 'rosa') {
    resultTitle.textContent = winner === currentSymbol ? '🎉 你获胜了！' : '😢 你输了';
    resultTitle.innerHTML = currentSymbol === 'rosa' ? '🎉 获胜！' : '😢 失败';
  } else if (winner === 'amber') {
    resultTitle.innerHTML = currentSymbol === 'amber' ? '🎉 获胜！' : '😢 失败';
  } else {
    resultTitle.textContent = '🤝 平局！';
  }
  
  resultDetails.innerHTML = `
    <p>🌿 罗莎 ${gameState.boardWinners.filter(w => w === 'rosa').length} 棋盘</p>
    <p>🔥 琥珀 ${gameState.boardWinners.filter(w => w === 'amber').length} 棋盘</p>
  `;

  // 提交到排行榜
  submitToLeaderboard(winner);
}

async function submitToLeaderboard(winner) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  let score = 0;
  if (winner === 'draw') score = 50;
  else if (winner === currentSymbol) score = 100;
  else score = 0;
  try {
    await fetch('/api/leaderboard/rosa-ember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        extra: { mode: 'online', result: winner }
      })
    });
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}

// 启动
document.addEventListener('DOMContentLoaded', init);

// ==================== 单人模式（VS 电脑）====================

let soloActive = false;
let soloRound = 1;
let soloScores = [];
let soloBotTimeout = null;
let soloPlayerSymbol = null; // 'rosa' = 先手, 'amber' = 后手

const winPatterns = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function initSoloState() {
  return {
    currentPlayer: 'rosa',
    activeBoard: null,
    boardWinners: Array(9).fill(null),
    boardData: Array(9).fill(null).map(() => Array(9).fill(null)),
    gameOver: false,
    winner: null
  };
}

let soloState = null;

function startSoloMode() {
  soloActive = true;
  soloRound = 1;
  soloScores = [];
  showSoloScreen('soloMenu');
}

function enterSoloGame(playerFirst) {
  soloPlayerSymbol = playerFirst;
  soloState = initSoloState();
  soloState.currentPlayer = 'rosa'; // rosa 永远先手
  showSoloScreen('soloGame');
  renderSoloBoard();
  updateSoloTurn();

  if (playerFirst !== 'rosa') {
    // 后手：电脑先走
    setTimeout(botMove, 800);
  }
}

function quitSoloMode() {
  soloActive = false;
  if (soloBotTimeout) clearTimeout(soloBotTimeout);
  showSoloScreen('menu');
}

function renderSoloBoard() {
  const board = document.getElementById('soloGlobalBoard');
  if (!board || !soloState) return;
  board.innerHTML = '';

  for (let bi = 0; bi < 9; bi++) {
    const miniBoard = document.createElement('div');
    miniBoard.className = 'mini-board';
    miniBoard.dataset.boardIndex = bi;

    const isActive = soloState.activeBoard === null || soloState.activeBoard === bi;
    const hasWinner = soloState.boardWinners[bi] !== null;

    if (!isActive || hasWinner || soloState.gameOver) {
      miniBoard.classList.add('disabled');
    }

    if (soloState.boardWinners[bi] === 'rosa') miniBoard.classList.add('winner-rosa');
    else if (soloState.boardWinners[bi] === 'amber') miniBoard.classList.add('winner-amber');

    for (let ci = 0; ci < 9; ci++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.boardIndex = bi;
      cell.dataset.cellIndex = ci;

      const value = soloState.boardData[bi][ci];
      if (value === 'rosa') {
        cell.textContent = '🌿';
        cell.classList.add('rosa', 'taken');
      } else if (value === 'amber') {
        cell.textContent = '🔥';
        cell.classList.add('amber', 'taken');
      }

      if (isActive && !hasWinner && !value && !soloState.gameOver) {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => soloMakeMove(bi, ci));
      } else {
        cell.classList.add('taken');
      }

      miniBoard.appendChild(cell);
    }
    board.appendChild(miniBoard);
  }
}

function updateSoloTurn() {
  const indicator = document.getElementById('soloTurnIndicator');
  if (!indicator || !soloState) return;
  const name = soloState.currentPlayer === 'rosa' ? '罗莎🌿' : '琥珀🔥';
  const isMyTurn = soloState.currentPlayer === soloPlayerSymbol;
  indicator.innerHTML = isMyTurn ? `轮到你了 (${name})` : `电脑思考中... (${name})`;
  indicator.className = `turn-indicator turn-${soloState.currentPlayer}`;
}

function soloMakeMove(bi, ci) {
  if (!soloState || soloState.gameOver) return;
  if (soloState.currentPlayer !== soloPlayerSymbol) return;

  const isActive = soloState.activeBoard === null || soloState.activeBoard === bi;
  if (!isActive) return;
  if (soloState.boardData[bi][ci] !== null) return;
  if (soloState.boardWinners[bi] !== null) return;

  doMove(soloState, bi, ci);
  renderSoloBoard();

  if (soloState.gameOver) {
    setTimeout(soloHandleGameOver, 500);
    return;
  }

  updateSoloTurn();
  setTimeout(botMove, 600);
}

function botMove() {
  if (!soloActive || !soloState || soloState.gameOver) return;
  if (soloState.currentPlayer === soloPlayerSymbol) return;

  const move = findBestBotMove(soloState);
  if (move) {
    doMove(soloState, move.bi, move.ci);
    renderSoloBoard();

    if (soloState.gameOver) {
      setTimeout(soloHandleGameOver, 500);
      return;
    }
    updateSoloTurn();
  }
}

function findBestBotMove(state) {
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;
  // 简单 AI：随机选一步
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getValidMoves(state) {
  const moves = [];
  const boards = state.activeBoard === null
    ? [...Array(9).keys()]
    : [state.activeBoard];

  for (const bi of boards) {
    if (state.boardWinners[bi] !== null) continue;
    for (let ci = 0; ci < 9; ci++) {
      if (state.boardData[bi][ci] === null) {
        moves.push({ bi, ci });
      }
    }
  }
  return moves;
}

function doMove(state, bi, ci) {
  state.boardData[bi][ci] = state.currentPlayer;

  const miniWinner = checkMiniWinner(state, bi);
  if (miniWinner) {
    state.boardWinners[bi] = miniWinner;
    const globalWinner = checkGlobalWinner(state);
    if (globalWinner) {
      state.gameOver = true;
      state.winner = globalWinner;
      return;
    }
  } else if (state.boardData[bi].every(c => c !== null)) {
    state.boardWinners[bi] = 'draw';
    if (state.boardWinners.every(w => w !== null)) {
      state.gameOver = true;
      state.winner = 'draw';
      return;
    }
  }

  const next = ci;
  state.activeBoard = state.boardWinners[next] !== null ? null : next;
  state.currentPlayer = state.currentPlayer === 'rosa' ? 'amber' : 'rosa';
}

function checkMiniWinner(state, bi) {
  const bd = state.boardData[bi];
  for (const p of winPatterns) {
    if (bd[p[0]] && bd[p[0]] === bd[p[1]] && bd[p[0]] === bd[p[2]]) return bd[p[0]];
  }
  return null;
}

function checkGlobalWinner(state) {
  const w = state.boardWinners;
  for (const p of winPatterns) {
    if (w[p[0]] && w[p[0]] === w[p[1]] && w[p[0]] === w[p[2]] && w[p[0]] !== 'draw') return w[p[0]];
  }
  return null;
}

function soloHandleGameOver() {
  const winner = soloState.winner;
  let score = 0;
  let resultText = '';

  if (winner === 'draw') {
    score = 50;
    resultText = '🤝 平局 (50分)';
  } else if (winner === soloPlayerSymbol) {
    score = 100;
    resultText = '🎉 你获胜了！ (100分)';
  } else {
    score = 0;
    resultText = '😢 你输了 (0分)';
  }

  soloScores.push(score);

  const resultTitle = document.getElementById('soloResultTitle');
  const resultDetails = document.getElementById('soloResultDetails');
  const bestDisplay = document.getElementById('soloBestDisplay');
  const nextBtn = document.getElementById('soloNextBtn');

  if (resultTitle) resultTitle.innerHTML = resultText;
  if (resultDetails) {
    resultDetails.innerHTML = `
      <p>🌿 罗莎 ${soloState.boardWinners.filter(w => w === 'rosa').length} 棋盘</p>
      <p>🔥 琥珀 ${soloState.boardWinners.filter(w => w === 'amber').length} 棋盘</p>
    `;
  }
  if (bestDisplay) bestDisplay.textContent = `当前最高分：${Math.max(...soloScores)}`;
  if (nextBtn) {
    if (soloRound >= 3) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'inline-block';
      nextBtn.textContent = `🔄 第${soloRound + 1}局`;
    }
  }

  // 报告成绩
  window.reportChallengeScore && window.reportChallengeScore(score);

  // 提交到排行榜
  submitToLeaderboardSolo(score);

  // 自动进入下一局或结束
  if (soloRound < 3) {
    showSoloScreen('soloResult');
    setTimeout(() => {
      soloRound++;
      soloState = initSoloState();
      soloState.currentPlayer = 'rosa';
      showSoloScreen('soloGame');
      renderSoloBoard();
      updateSoloTurn();

      if (soloPlayerSymbol !== 'rosa') {
        setTimeout(botMove, 800);
      }
    }, 2500);
  } else {
    showSoloScreen('soloResult');
    if (resultDetails) {
      resultDetails.innerHTML += `<p style="margin-top:10px;">3局得分：${soloScores.join(' / ')}</p>`;
    }
    if (bestDisplay) bestDisplay.textContent = `最终最高分：${Math.max(...soloScores)}`;
  }
}

function soloNextRound() {
  soloRound++;
  soloState = initSoloState();
  soloState.currentPlayer = 'rosa';
  showSoloScreen('soloGame');
  renderSoloBoard();
  updateSoloTurn();

  if (soloPlayerSymbol !== 'rosa') {
    setTimeout(botMove, 800);
  }
}

function finishSoloChallenge() {
  soloActive = false;
  if (soloBotTimeout) clearTimeout(soloBotTimeout);
  localStorage.removeItem('challengeSessionId');
  localStorage.removeItem('challengeGameId');
  localStorage.removeItem('challengeActivityId');
  window.location.href = '/activity.html';
}

async function submitToLeaderboardSolo(score) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  try {
    await fetch('/api/leaderboard/rosa-ember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        extra: { mode: 'solo', symbol: soloPlayerSymbol }
      })
    });
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}

function showSoloScreen(screen) {
  const menuScreenEl = document.getElementById('menuScreen');
  const soloMenuScreen = document.getElementById('soloMenuScreen');
  const soloGameScreen = document.getElementById('soloGameScreen');
  const soloResultScreen = document.getElementById('soloResultScreen');

  if (menuScreenEl) menuScreenEl.style.display = 'none';
  if (soloMenuScreen) soloMenuScreen.style.display = screen === 'soloMenu' ? 'block' : 'none';
  if (soloGameScreen) soloGameScreen.style.display = screen === 'soloGame' ? 'block' : 'none';
  if (soloResultScreen) soloResultScreen.style.display = screen === 'soloResult' ? 'block' : 'none';
}

// 事件绑定
document.addEventListener('DOMContentLoaded', () => {
  const soloModeBtn = document.getElementById('soloModeBtn');
  const soloStartRosaBtn = document.getElementById('soloStartRosaBtn');
  const soloStartAmberBtn = document.getElementById('soloStartAmberBtn');
  const soloBackBtn = document.getElementById('soloBackBtn');
  const soloQuitBtn = document.getElementById('soloQuitBtn');
  const soloNextBtn = document.getElementById('soloNextBtn');
  const soloFinishBtn = document.getElementById('soloFinishBtn');

  if (soloModeBtn) soloModeBtn.addEventListener('click', startSoloMode);
  if (soloStartRosaBtn) soloStartRosaBtn.addEventListener('click', () => enterSoloGame('rosa'));
  if (soloStartAmberBtn) soloStartAmberBtn.addEventListener('click', () => enterSoloGame('amber'));
  if (soloBackBtn) soloBackBtn.addEventListener('click', () => showSoloScreen('menu'));
  if (soloQuitBtn) soloQuitBtn.addEventListener('click', quitSoloMode);
  if (soloNextBtn) soloNextBtn.addEventListener('click', soloNextRound);
  if (soloFinishBtn) soloFinishBtn.addEventListener('click', finishSoloChallenge);

  // 自动检测 URL 参数进入单人模式
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'solo') {
    setTimeout(() => {
      startSoloMode();
    }, 500);
  }
});