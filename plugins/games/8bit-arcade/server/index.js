/**
 * 8比特街机 - 经典跑酷联机对战游戏
 * Socket.io 命名空间和房间管理
 */

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const ROOM_TIMEOUT = 30 * 60 * 1000;

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function initGameState() {
  return {
    isRunning: false,
    isGameOver: false,
    players: {
      player1: { score: 0, isGameOver: false, nickname: '' },
      player2: { score: 0, isGameOver: false, nickname: '' }
    },
    winner: null
  };
}

module.exports = function(app, context) {
  const io = context.io;
  const storage = context.storage;
  const eventBus = context.eventBus;
  const logger = context.logger;

  const roomsKey = 'eight-bit-rooms';
  const rooms = storage.get(roomsKey) || new Map();

  function createRoom() {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    const room = {
      code: roomCode,
      players: [],
      gameState: initGameState(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isStarted: false,
      difficulty: 'normal'
    };
    rooms.set(roomCode, room);
    storage.set(roomsKey, rooms);
    return room;
  }

  function cleanupTimeoutRooms() {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > ROOM_TIMEOUT) {
        gameIO.to(code).emit('roomTimeout', '房间因长时间无活动已自动关闭');
        rooms.delete(code);
        logger.info(`房间 ${code} 因超时已清理`);
      }
    }
    storage.set(roomsKey, rooms);
  }

  setInterval(cleanupTimeoutRooms, 5 * 60 * 1000);

  const gameIO = io.of('/8bit-arcade');

  gameIO.on('connection', (socket) => {
    logger.info('玩家连接: ' + socket.id);

    socket.on('createRoom', (data, callback) => {
      const room = createRoom();
      room.difficulty = data?.difficulty || 'normal';

      const player = {
        id: socket.id,
        role: 'player1',
        nickname: data?.nickname || '玩家1'
      };
      room.players.push(player);
      socket.join(room.code);

      socket.data.roomCode = room.code;
      socket.data.playerRole = 'player1';

      room.gameState.players.player1.nickname = player.nickname;

      callback({
        success: true,
        roomCode: room.code,
        playerRole: 'player1',
        difficulty: room.difficulty,
        gameState: room.gameState,
        players: room.players.map(p => ({ role: p.role, nickname: p.nickname, isOnline: true }))
      });

      logger.info(`房间 ${room.code} 已创建，玩家1加入`);
    });

    socket.on('joinRoom', (roomCode, data, callback) => {
      roomCode = roomCode.toUpperCase().trim();
      const room = rooms.get(roomCode);

      if (!room) {
        callback({ success: false, reason: '房间不存在' });
        return;
      }

      if (room.players.length >= 2) {
        callback({ success: false, reason: '房间已满' });
        return;
      }

      if (room.isStarted) {
        callback({ success: false, reason: '游戏已开始，无法加入' });
        return;
      }

      const player = {
        id: socket.id,
        role: 'player2',
        nickname: data?.nickname || '玩家2'
      };
      room.players.push(player);
      socket.join(room.code);

      socket.data.roomCode = room.code;
      socket.data.playerRole = 'player2';

      room.gameState.players.player2.nickname = player.nickname;

      callback({
        success: true,
        roomCode: room.code,
        playerRole: 'player2',
        difficulty: room.difficulty,
        gameState: room.gameState,
        players: room.players.map(p => ({ role: p.role, nickname: p.nickname, isOnline: true }))
      });

      gameIO.to(room.code).emit('playerJoined', {
        gameState: room.gameState,
        players: room.players.map(p => ({ role: p.role, nickname: p.nickname, isOnline: true }))
      });

      logger.info(`玩家2加入房间 ${room.code}`);
    });

    socket.on('startGame', (callback) => {
      const roomCode = socket.data.roomCode;
      const room = rooms.get(roomCode);

      if (!room) {
        callback({ success: false, reason: '房间不存在' });
        return;
      }

      if (room.players.length < 2) {
        callback({ success: false, reason: '需要2名玩家才能开始' });
        return;
      }

      room.isStarted = true;
      room.gameState.isRunning = true;
      room.gameState.isGameOver = false;
      room.gameState.players.player1.score = 0;
      room.gameState.players.player1.isGameOver = false;
      room.gameState.players.player2.score = 0;
      room.gameState.players.player2.isGameOver = false;
      room.gameState.winner = null;
      room.lastActivity = Date.now();

      callback({ success: true, gameState: room.gameState });
      socket.to(roomCode).emit('gameStarted', { gameState: room.gameState });

      logger.info(`房间 ${room.code} 游戏开始`);
    });

    socket.on('updateScore', (score, callback) => {
      const roomCode = socket.data.roomCode;
      const room = rooms.get(roomCode);

      if (!room || !room.gameState.isRunning) {
        callback({ success: false, reason: '游戏未运行' });
        return;
      }

      const playerRole = socket.data.playerRole;
      room.gameState.players[playerRole].score = score;
      room.lastActivity = Date.now();

      callback({ success: true });
      socket.to(roomCode).emit('opponentScoreUpdate', {
        playerRole: playerRole,
        score: score
      });
    });

    socket.on('gameOver', (score, callback) => {
      const roomCode = socket.data.roomCode;
      const room = rooms.get(roomCode);

      if (!room) {
        callback({ success: false, reason: '房间不存在' });
        return;
      }

      const playerRole = socket.data.playerRole;
      room.gameState.players[playerRole].score = score;
      room.gameState.players[playerRole].isGameOver = true;
      room.lastActivity = Date.now();

      const p1Over = room.gameState.players.player1.isGameOver;
      const p2Over = room.gameState.players.player2.isGameOver;

      const result = { success: true, bothFinished: false };

      if (p1Over && p2Over) {
        room.gameState.isRunning = false;
        room.gameState.isGameOver = true;

        const p1Score = room.gameState.players.player1.score;
        const p2Score = room.gameState.players.player2.score;

        if (p1Score > p2Score) {
          room.gameState.winner = 'player1';
        } else if (p2Score > p1Score) {
          room.gameState.winner = 'player2';
        } else {
          room.gameState.winner = 'draw';
        }

        result.bothFinished = true;
        result.gameState = room.gameState;

        gameIO.to(roomCode).emit('gameOver', { gameState: room.gameState });

        logger.info(`房间 ${room.code} 游戏结束，胜者: ${room.gameState.winner}`);
      } else {
        socket.to(roomCode).emit('opponentGameOver', {
          playerRole: playerRole,
          score: score
        });
      }

      callback(result);
    });

    socket.on('restartGame', (callback) => {
      const roomCode = socket.data.roomCode;
      const room = rooms.get(roomCode);

      if (!room) {
        callback({ success: false, reason: '房间不存在' });
        return;
      }

      if (room.players.length < 2) {
        callback({ success: false, reason: '对手已离开，无法重新开始' });
        return;
      }

      room.gameState = initGameState();
      room.gameState.players.player1.nickname = room.players[0]?.nickname || '玩家1';
      room.gameState.players.player2.nickname = room.players[1]?.nickname || '玩家2';
      room.lastActivity = Date.now();

      callback({ success: true, gameState: room.gameState });
      socket.to(roomCode).emit('gameRestarted', { gameState: room.gameState });
    });

    socket.on('ping', (callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const playerRole = room.players[playerIndex].role;

        socket.to(roomCode).emit('playerDisconnected', {
          role: playerRole,
          message: `${room.players[playerIndex].nickname} 已断开连接`
        });

        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          setTimeout(() => {
            const r = rooms.get(roomCode);
            if (r && r.players.length === 0) {
              rooms.delete(roomCode);
              logger.info(`房间 ${roomCode} 已空，自动清理`);
            }
          }, 60000);
        }
      }

      logger.info(`玩家断开: ${socket.id}，房间: ${roomCode}`);
    });
  });

  logger.info('8-bit Arcade game plugin initialized');

  return { rooms, createRoom, initGameState };
};