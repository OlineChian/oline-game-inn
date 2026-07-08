'use strict';

/**
 * 巅峰双重挑战 - 业务逻辑服务
 * 职责：绑定、成绩查询、抽奖编排、admin 辅助
 * 数据键：player:{tag}、nick-bind:{nickname}、config、logs:{tag}
 */

const fs = require('fs');
const path = require('path');
const { calculateWeight, performDraw } = require('./lottery');
const { validateTag, checkRateLimit, logAction, getClientIp, getUserAgent } = require('./guard');

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'activities', 'peak-dual', 'config.json');
const DEFAULT_RUNTIME = { totalPrize: 20, remainPrize: 20, totalGuaranteedDraw: 150, currentDrawCount: 0, maxDrawsPerPlayer: 5 };
const GAME_A = 'brawl-frontline';
const GAME_B = 'chester-cards';

class PeakDualService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = this._loadConfig();
    this._ensureRuntimeConfig();
  }

  _loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
    catch (e) { this.logger.error('[peak-dual] 加载配置失败: ' + e.message); return { games: [], tag: {}, lottery: {} }; }
  }

  _ensureRuntimeConfig() {
    if (!this.storage.has('config')) {
      const merged = { ...DEFAULT_RUNTIME, ...this.config.lottery };
      this.storage.set('config', merged);
    }
  }

  getRuntimeConfig() { return this.storage.get('config') || { ...DEFAULT_RUNTIME }; }

  setRuntimeConfig(payload) {
    const current = this.getRuntimeConfig();
    if (payload.totalPrize != null) current.totalPrize = Math.max(1, Number(payload.totalPrize) || 20);
    if (payload.totalGuaranteedDraw != null) current.totalGuaranteedDraw = Math.max(1, Number(payload.totalGuaranteedDraw) || 150);
    if (payload.maxDrawsPerPlayer != null) current.maxDrawsPerPlayer = Math.max(1, Number(payload.maxDrawsPerPlayer) || 5);
    this.storage.set('config', current);
    return { success: true, config: current };
  }

  _queryUserBest(gameId, nickname) {
    let result = null;
    this.eventBus.emit('leaderboard:get-user-best', { gameId, nickname, callback: (r) => { result = r; } });
    return result;
  }

  _queryTopScore(gameId) {
    let result = null;
    this.eventBus.emit('leaderboard:get-top-score', { gameId, callback: (r) => { result = r; } });
    return result || { topScore: 0, total: 0 };
  }

  _fetchScores(nickname) {
    const a = this._queryUserBest(GAME_A, nickname);
    const b = this._queryUserBest(GAME_B, nickname);
    const topA = this._queryTopScore(GAME_A);
    const topB = this._queryTopScore(GAME_B);
    if (!a || a.error || a.bestScore == null) return { error: '请先在乱斗前线中游戏并提交成绩', code: 400 };
    if (!b || b.error || b.bestScore == null) return { error: '请先在切斯特牌中游戏并提交成绩', code: 400 };
    const weight = calculateWeight(a.bestScore, a.rank, b.bestScore, b.rank, topA.topScore, topB.topScore);
    return { gameAScore: a.bestScore, gameARank: a.rank, gameBScore: b.bestScore, gameBRank: b.rank, weight };
  }

  bind(playerTag, gameNickname) {
    if (!validateTag(playerTag)) return { error: 'Player Tag 格式不正确', code: 400 };
    if (!gameNickname || !gameNickname.trim()) return { error: '游戏昵称不能为空', code: 400 };
    const tag = playerTag.trim();
    const nick = gameNickname.trim().slice(0, 20);
    const existing = this.storage.get('player:' + tag);
    if (existing) return { success: true, player: existing, alreadyBound: true };
    const bindKey = 'nick-bind:' + nick;
    const bound = this.storage.get(bindKey);
    if (bound && bound.playerTag !== tag) return { error: '该游戏昵称已被其他玩家绑定', code: 400 };
    const player = {
      playerTag: tag, gameNickname: nick,
      gameAScore: 0, gameARank: null, gameBScore: 0, gameBRank: null,
      currentWeight: 0, lastDrawWeight: 0,
      drawCount: 0, hasWon: false, prizeId: null, winTime: null,
      createdAt: Date.now(), lastQueryAt: 0
    };
    this.storage.set('player:' + tag, player);
    this.storage.set(bindKey, { playerTag: tag, boundAt: Date.now() });
    this.logger.info('[peak-dual] 绑定: ' + tag + ' → ' + nick);
    return { success: true, player };
  }

  query(playerTag, req) {
    if (!validateTag(playerTag)) return { error: 'Player Tag 格式不正确', code: 400 };
    const tag = playerTag.trim();
    const player = this.storage.get('player:' + tag);
    if (!player) return { error: '请先绑定 Player Tag', code: 404 };
    const ip = getClientIp(req);
    const rl = checkRateLimit(this.storage, ip, 'query');
    if (!rl.ok) return { error: '查询过于频繁，请 ' + rl.retryAfter + ' 秒后再试', code: 429 };
    const scores = this._fetchScores(player.gameNickname);
    if (scores.error) {
      logAction(this.storage, tag, { type: 'query', timestamp: Date.now(), ip, ua: getUserAgent(req), result: 'error', error: scores.error });
      return scores;
    }
    player.gameAScore = scores.gameAScore; player.gameARank = scores.gameARank;
    player.gameBScore = scores.gameBScore; player.gameBRank = scores.gameBRank;
    player.currentWeight = scores.weight;
    player.lastQueryAt = Date.now();
    this.storage.set('player:' + tag, player);
    logAction(this.storage, tag, { type: 'query', timestamp: Date.now(), ip, ua: getUserAgent(req), weight: scores.weight, result: 'success' });
    return { success: true, player, config: this.getRuntimeConfig() };
  }

  draw(playerTag, req) {
    if (!validateTag(playerTag)) return { error: 'Player Tag 格式不正确', code: 400 };
    const tag = playerTag.trim();
    const player = this.storage.get('player:' + tag);
    if (!player) return { error: '请先绑定 Player Tag', code: 404 };
    if (player.hasWon) return { error: '已中奖，无法再次抽奖', code: 400 };
    const config = this.getRuntimeConfig();
    if (player.drawCount >= config.maxDrawsPerPlayer) return { error: '已达最大抽奖次数', code: 400 };
    if (config.remainPrize <= 0) return { error: '奖品已发完', code: 400 };
    const ip = getClientIp(req);
    const rl = checkRateLimit(this.storage, ip, 'draw');
    if (!rl.ok) return { error: '抽奖过于频繁，请 ' + rl.retryAfter + ' 秒后再试', code: 429 };
    const scores = this._fetchScores(player.gameNickname);
    if (scores.error) return scores;
    if (player.drawCount > 0 && scores.weight <= player.lastDrawWeight)
      return { error: '成绩未提升，请先提升成绩后再抽奖', code: 400 };
    player.currentWeight = scores.weight;
    const result = performDraw(player, config);
    player.lastDrawWeight = scores.weight;
    player.drawCount += 1;
    if (result.won) {
      player.hasWon = true;
      player.prizeId = 'PRIZE-' + (config.totalPrize - config.remainPrize + 1);
      player.winTime = Date.now();
      config.remainPrize -= 1;
    }
    config.currentDrawCount += 1;
    this.storage.set('player:' + tag, player);
    this.storage.set('config', config);
    logAction(this.storage, tag, { type: 'draw', timestamp: Date.now(), ip, ua: getUserAgent(req), weight: scores.weight, result: result.won ? 'win' : 'lose', drawCount: player.drawCount, probability: result.probability });
    this.logger.info('[peak-dual] 抽奖: ' + tag + ' → ' + (result.won ? '中奖' : '未中') + ' (p=' + result.probability.toFixed(3) + ')');
    return { success: true, won: result.won, probability: result.probability, isPityDraw: result.isPityDraw, player, config: { remainPrize: config.remainPrize, currentDrawCount: config.currentDrawCount } };
  }

  getPlayer(playerTag) {
    if (!validateTag(playerTag)) return { error: 'Player Tag 格式不正确', code: 400 };
    const player = this.storage.get('player:' + playerTag.trim());
    if (!player) return { error: '未找到玩家', code: 404 };
    return { success: true, player, config: this.getRuntimeConfig() };
  }

  getStatus() {
    const config = this.getRuntimeConfig();
    const players = this.listPlayers().players;
    const winners = players.filter(p => p.hasWon);
    return { success: true, config, totalPlayers: players.length, totalWinners: winners.length };
  }

  listPlayers() {
    const players = this.storage.list('player:').map(i => i.value).filter(Boolean);
    players.sort((a, b) => (b.currentWeight || 0) - (a.currentWeight || 0));
    return { success: true, players };
  }

  getWinners() {
    const winners = this.listPlayers().players.filter(p => p.hasWon);
    return { success: true, winners };
  }

  getLogs() {
    const allLogs = [];
    for (const item of this.storage.list('logs:')) {
      const tag = item.key.replace('logs:', '');
      for (const entry of item.value || []) allLogs.push({ playerTag: tag, ...entry });
    }
    allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return { success: true, logs: allLogs.slice(0, 500) };
  }
}

module.exports = PeakDualService;
