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
  // 排行榜记录累计胜场：只有胜利才计入，平局和负局不计
  if (winner !== currentSymbol) return;
  await submitWinToLeaderboard('online', 'online');
}

// 提交胜利记录（sum 聚合模型：每次胜利提交 score=1，service 按昵称求和）
// difficulty: 'online' | 'easy' | 'normal' | 'hard'
async function submitWinToLeaderboard(mode, difficulty) {
  const nickname = localStorage.getItem('gameNickname');
  if (!nickname || !nickname.trim()) return;
  if (!window.ScoreSigner) {
    console.warn('ScoreSigner 未加载，跳过成绩提交');
    return;
  }

  try {
    const sig = await window.ScoreSigner.sign({ gameId: 'rosa-ember', nickname, score: 1 });
    const response = await fetch('/api/leaderboard/rosa-ember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score: 1,
        extra: { mode, difficulty: difficulty || mode, result: 'win' },
        timestamp: sig.timestamp,
        nonce: sig.nonce,
        signature: sig.signature
      })
    });
    // 安全事件统一入口：403 封禁 / 200 警告（成绩不上传）自动弹窗
    if (window.BanNotice && await window.BanNotice.handleSecurityEvent(response)) return;
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}

// ==================== 排行榜弹窗（顶部按钮触发）====================
function showLeaderboard() {
  const modal = document.getElementById('leaderboardModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  // 读取当前激活的难度 tab
  const activeTab = modal.querySelector('.lb-diff-tab.active');
  loadLeaderboard(activeTab ? activeTab.dataset.diff : '');
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
    const url = '/api/leaderboard/rosa-ember' + (difficulty ? `?difficulty=${difficulty}` : '');
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
      listEl.innerHTML = '<div class="lb-empty"><div class="lb-empty-icon">🌿</div><p>暂无排行记录</p><p style="font-size:12px;margin-top:5px;">快去挑战成为第一名吧！</p></div>';
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

// 启动
document.addEventListener('DOMContentLoaded', init);

// ==================== 单人模式（VS 电脑）====================

let soloActive = false;
let soloRound = 1;
let soloScores = [];
let soloBotTimeout = null;
let soloPlayerSymbol = null; // 'rosa' = 先手, 'amber' = 后手
let soloDifficulty = 'easy'; // 'easy' | 'normal' | 'hard'，单人 AI 难度

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

function enterSoloGame(playerFirst, difficulty) {
  soloPlayerSymbol = playerFirst;
  soloDifficulty = difficulty || 'easy';
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

  const move = findBestBotMove(soloState, soloDifficulty);
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

/**
 * 三档 AI：
 * - easy：纯随机
 * - normal：启发式（优先取胜 → 封堵对手立即取胜 → 优先中心 → 随机）
 * - hard：增强启发式（normal 基础上 + 双威胁布局 + 避免把好棋盘让给对手）
 */
function findBestBotMove(state, difficulty) {
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;

  if (difficulty === 'hard') {
    return findHardMove(state, validMoves);
  }
  if (difficulty === 'normal') {
    return findNormalMove(state, validMoves);
  }
  // easy：纯随机
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

// 中等 AI：能赢就赢 → 能堵就堵 → 中心格 → 随机
function findNormalMove(state, validMoves) {
  const botSymbol = state.currentPlayer;
  const oppSymbol = botSymbol === 'rosa' ? 'amber' : 'rosa';

  // 1. 立即取胜
  const winMove = findWinningMove(state, botSymbol);
  if (winMove) return winMove;

  // 2. 封堵对手立即取胜
  const blockMove = findWinningMove(state, oppSymbol);
  if (blockMove) return blockMove;

  // 3. 优先中心格（每个 mini-board 的中心是 4，全局中心是 4 号棋盘）
  const centerMoves = validMoves.filter(m => m.ci === 4);
  if (centerMoves.length > 0) {
    return centerMoves[Math.floor(Math.random() * centerMoves.length)];
  }

  // 4. 随机
  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

// 困难 AI：中等基础上 + 制造双威胁 + 避免把可胜棋盘让给对手
function findHardMove(state, validMoves) {
  const botSymbol = state.currentPlayer;
  const oppSymbol = botSymbol === 'rosa' ? 'amber' : 'rosa';

  // 1. 立即取胜
  const winMove = findWinningMove(state, botSymbol);
  if (winMove) return winMove;

  // 2. 封堵对手立即取胜
  const blockMove = findWinningMove(state, oppSymbol);
  if (blockMove) return blockMove;

  // 3. 评分选择：制造自身威胁 + 避免送给对手好棋盘
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of validMoves) {
    const score = evaluateMove(state, move, botSymbol, oppSymbol);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// 评估某一步的得分
function evaluateMove(state, move, botSymbol, oppSymbol) {
  let score = 0;

  // 模拟落子
  const sim = cloneState(state);
  doMove(sim, move.bi, move.ci);

  // 加分：模拟后能制造几个潜在取胜线（mini-board 内）
  const myThreats = countThreats(sim, botSymbol);
  score += myThreats * 3;

  // 减分：模拟后对手在该棋盘有取胜机会
  const oppThreats = countThreats(sim, oppSymbol);
  score -= oppThreats * 2;

  // 加分：落到中心格
  if (move.ci === 4) score += 2;

  // 加分：赢得 mini-board
  if (sim.boardWinners[move.bi] === botSymbol) score += 5;

  // 减分：下一步会把对手送到已赢/好棋盘（activeBoard 让对手主导）
  const nextBoard = sim.activeBoard;
  if (nextBoard !== null && sim.boardWinners[nextBoard] === oppSymbol) {
    score -= 4;
  }

  return score;
}

// 统计某玩家在所有 mini-board 的潜在取胜线数（2 子 + 1 空）
function countThreats(state, symbol) {
  let count = 0;
  for (let bi = 0; bi < 9; bi++) {
    if (state.boardWinners[bi] !== null) continue;
    const bd = state.boardData[bi];
    for (const p of winPatterns) {
      const cells = [bd[p[0]], bd[p[1]], bd[p[2]]];
      const mine = cells.filter(c => c === symbol).length;
      const empty = cells.filter(c => c === null).length;
      if (mine === 2 && empty === 1) count++;
    }
  }
  return count;
}

// 查找能让指定玩家立即取胜的落子
function findWinningMove(state, symbol) {
  const validMoves = getValidMoves(state);
  for (const move of validMoves) {
    const sim = cloneState(state);
    doMove(sim, move.bi, move.ci);
    if (sim.gameOver && sim.winner === symbol) return move;
    // 也算 mini-board 即将取胜的封堵（非全局取胜）
    if (sim.boardWinners[move.bi] === symbol) {
      // 如果这步能赢得 mini-board 且形成全局威胁，优先
      const globalSim = cloneState(state);
      doMove(globalSim, move.bi, move.ci);
      if (createsGlobalThreat(globalSim, symbol)) return move;
    }
  }
  return null;
}

// 判断赢得某 mini-board 后是否形成全局取胜威胁（2 个棋盘连线 + 第 3 个可争）
function createsGlobalThreat(state, symbol) {
  const w = state.boardWinners;
  for (const p of winPatterns) {
    const a = w[p[0]], b = w[p[1]], c = w[p[2]];
    const mine = [a, b, c].filter(x => x === symbol).length;
    const empty = [a, b, c].filter(x => x === null).length;
    if (mine === 2 && empty === 1) return true;
  }
  return false;
}

// 浅克隆游戏状态（用于 AI 模拟）
function cloneState(state) {
  return {
    currentPlayer: state.currentPlayer,
    activeBoard: state.activeBoard,
    boardWinners: [...state.boardWinners],
    boardData: state.boardData.map(bd => [...bd]),
    gameOver: state.gameOver,
    winner: state.winner
  };
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
  // 排行榜记录累计胜场：只有胜利（100分）才计入，平局(50)/负局(0)不计
  if (score < 100) return;
  await submitWinToLeaderboard('solo', soloDifficulty);
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
  // 单人模式：选择执棋时读取当前选中的难度
  if (soloStartRosaBtn) soloStartRosaBtn.addEventListener('click', () => enterSoloGame('rosa', soloDifficulty));
  if (soloStartAmberBtn) soloStartAmberBtn.addEventListener('click', () => enterSoloGame('amber', soloDifficulty));
  if (soloBackBtn) soloBackBtn.addEventListener('click', () => showSoloScreen('menu'));
  if (soloQuitBtn) soloQuitBtn.addEventListener('click', quitSoloMode);
  if (soloNextBtn) soloNextBtn.addEventListener('click', soloNextRound);
  if (soloFinishBtn) soloFinishBtn.addEventListener('click', finishSoloChallenge);

  // 难度选择按钮：点击切换 active 并更新 soloDifficulty
  const diffBtns = document.querySelectorAll('.solo-diff-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      soloDifficulty = btn.dataset.diff || 'easy';
    });
  });

  // 排行榜 modal 事件
  const lbModal = document.getElementById('leaderboardModal');
  if (lbModal) {
    // 点击外部关闭
    lbModal.addEventListener('click', (e) => {
      if (e.target === lbModal) closeLeaderboard();
    });
    // 难度 tab 切换
    const diffTabs = lbModal.querySelectorAll('.lb-diff-tab');
    diffTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        diffTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadLeaderboard(tab.dataset.diff || '');
      });
    });
  }

  // 自动检测 URL 参数进入单人模式
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'solo') {
    setTimeout(() => {
      startSoloMode();
    }, 500);
  }
});