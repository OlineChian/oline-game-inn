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
}

// 启动
document.addEventListener('DOMContentLoaded', init);