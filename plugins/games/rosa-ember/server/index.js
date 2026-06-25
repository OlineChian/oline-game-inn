/**
 * 罗莎琥珀好姐妹 - 终极井字棋联机游戏
 * Socket.io 命名空间和房间管理
 */

const winPatterns = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const CODEChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CodeLength = 6;
const Timeout = 30 * 60 * 1000;

function generateCode() {
  let c = '';
  for (let i = 0; i < CodeLength; i++) c += CodeChars[Math.floor(Math.random() * CodeChars.length)];
  return c;
}

function initState() {
  return {
    currentPlayer: 'rosa',
    activeBoard: null,
    boardWinners: Array(9).fill(null),
    boardData: Array(9).fill(null).map(() => Array(9).fill(null)),
    gameOver: false,
    winner: null
  };
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

function isFull(state, bi) { return state.boardData[bi].every(c => c !== null); }
function isAllDone(state) { return state.boardWinners.every(w => w !== null); }

function makeMove(room, pid, bi, ci) {
  const s = room.gameState;
  if (s.gameOver) return { success: false, reason: '游戏已结束' };
  
  const pi = room.players.findIndex(p => p.id === pid);
  if (pi === -1) return { success: false, reason: '玩家不在房间内' };
  
  const sym = pi === 0 ? 'rosa' : 'amber';
  if (s.currentPlayer !== sym) return { success: false, reason: '不是你的回合' };
  if (s.activeBoard !== null && s.activeBoard !== bi) return { success: false, reason: '无效棋盘' };
  if (s.boardData[bi][ci] !== null) return { success: false, reason: '位置已占用' };
  if (s.boardWinners[bi] !== null) return { success: false, reason: '棋盘已结束' };
  
  s.boardData[bi][ci] = sym;
  
  const mini = checkMiniWinner(s, bi);
  if (mini) {
    s.boardWinners[bi] = mini;
    const global = checkGlobalWinner(s);
    if (global) { s.gameOver = true; s.winner = global; return { success: true, gameOver: true, winner: global }; }
  } else if (isFull(s, bi)) {
    s.boardWinners[bi] = 'draw';
    if (isAllDone(s)) { s.gameOver = true; s.winner = 'draw'; return { success: true, gameOver: true, winner: 'draw' }; }
  }
  
  const next = ci;
  s.activeBoard = (s.boardWinners[next] !== null || isFull(s, next)) ? null : next;
  s.currentPlayer = s.currentPlayer === 'rosa' ? 'amber' : 'rosa';
  room.lastActivity = Date.now();
  return { success: true };
}

module.exports = function(app, context) {
  const io = context.io;
  const storage = context.storage;
  const eventBus = context.eventBus;
  const logger = context.logger;
  
  const gameIO = io.of('/rosa-ember');
  const roomsKey = 'rooms';
  let rooms = storage.get(roomsKey) || new Map();
  
  function createRoom() {
    let code;
    do { code = generateCode(); } while (rooms.has(code));
    const room = { code, players: [], gameState: initState(), createdAt: Date.now(), lastActivity: Date.now(), isStarted: false };
    rooms.set(code, room);
    storage.set(roomsKey, rooms);
    return room;
  }
  
  function cleanup() {
    const now = Date.now();
    for (const [c, r] of rooms) {
      if (now - r.lastActivity > Timeout) {
        gameIO.to(c).emit('roomTimeout', '房间超时关闭');
        rooms.delete(c);
        logger.info(`房间 ${c} 超时清理`);
      }
    }
    storage.set(roomsKey, rooms);
  }
  
  setInterval(cleanup, 5 * 60 * 1000);
  
  gameIO.on('connection', (socket) => {
    logger.info('Rosa-Ember 玩家连接: ' + socket.id);
    
    socket.on('createRoom', (cb) => {
      const room = createRoom();
      const p = { id: socket.id, symbol: 'rosa', name: '罗莎' };
      room.players.push(p);
      socket.join(room.code);
      socket.data = { roomCode: room.code, playerSymbol: 'rosa' };
      cb({ success: true, roomCode: room.code, playerSymbol: 'rosa', gameState: room.gameState, players: room.players.map(p => ({ symbol: p.symbol, name: p.name, isOnline: true })) });
      logger.info(`Rosa-Ember 房间 ${room.code} 创建`);
    });
    
    socket.on('joinRoom', (code, cb) => {
      code = code.toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { cb({ success: false, reason: '房间不存在' }); return; }
      if (room.players.length >= 2) { cb({ success: false, reason: '房间已满' }); return; }
      if (room.isStarted) { cb({ success: false, reason: '游戏已开始' }); return; }
      
      const p = { id: socket.id, symbol: 'amber', name: '琥珀' };
      room.players.push(p);
      socket.join(code);
      socket.data = { roomCode: code, playerSymbol: 'amber' };
      room.isStarted = true;
      room.lastActivity = Date.now();
      
      cb({ success: true, roomCode: code, playerSymbol: 'amber', gameState: room.gameState, players: room.players.map(p => ({ symbol: p.symbol, name: p.name, isOnline: true })) });
      gameIO.to(code).emit('gameStart', { gameState: room.gameState, players: room.players.map(p => ({ symbol: p.symbol, name: p.name, isOnline: true })) });
      logger.info(`Rosa-Ember 玩家加入房间 ${code}`);
    });
    
    socket.on('makeMove', (data, cb) => {
      const code = socket.data?.roomCode;
      const room = rooms.get(code);
      if (!room) { cb({ success: false, reason: '房间不存在' }); return; }
      
      const res = makeMove(room, socket.id, data.boardIndex, data.cellIndex);
      if (res.success) {
        cb({ success: true });
        gameIO.to(code).emit('gameStateUpdate', { gameState: room.gameState, lastMove: { boardIndex: data.boardIndex, cellIndex: data.cellIndex } });
        if (res.gameOver) gameIO.to(code).emit('gameOver', { winner: res.winner, gameState: room.gameState });
      } else cb(res);
    });
    
    socket.on('restartGame', (cb) => {
      const code = socket.data?.roomCode;
      const room = rooms.get(code);
      if (!room) { cb({ success: false, reason: '房间不存在' }); return; }
      if (room.players.length < 2) { cb({ success: false, reason: '对手已离开' }); return; }
      
      room.gameState = initState();
      room.lastActivity = Date.now();
      cb({ success: true, gameState: room.gameState });
      socket.to(code).emit('gameRestarted', { gameState: room.gameState });
    });
    
    socket.on('ping', (cb) => { cb({ pong: true, timestamp: Date.now() }); });
    
    socket.on('disconnect', () => {
      const code = socket.data?.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi !== -1) {
        const sym = room.players[pi].symbol;
        socket.to(code).emit('playerDisconnected', { symbol: sym, message: sym === 'rosa' ? '罗莎已断开' : '琥珀已断开' });
        room.players.splice(pi, 1);
        if (room.players.length === 0) {
          setTimeout(() => {
            if (rooms.get(code)?.players.length === 0) { rooms.delete(code); logger.info(`Rosa-Ember 房间 ${code} 清理`); }
          }, 60000);
        }
      }
      logger.info(`Rosa-Ember 玩家断开: ${socket.id}`);
    });
  });
  
  logger.info('Rosa-Ember game plugin initialized with namespace /rosa-ember');
  
  return { rooms, createRoom, makeMove };
};