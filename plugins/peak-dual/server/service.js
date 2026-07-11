'use strict';

/**
 * 巅峰双重挑战 - 业务逻辑服务
 * 职责：绑定、成绩查询（按参与时间过滤）、抽奖编排（Score 资格判断）、admin 辅助
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

  /**
   * 更新运行时配置 — 修改任何参数后重算 remainPrize（基于实际中奖人数）
   * 确保 totalPrize / totalGuaranteedDraw / maxDrawsPerPlayer 变更后全系统一致
   */
  setRuntimeConfig(payload) {
    const current = this.getRuntimeConfig();
    if (payload.totalPrize != null) current.totalPrize = Math.max(1, Number(payload.totalPrize) || 20);
    if (payload.totalGuaranteedDraw != null) current.totalGuaranteedDraw = Math.max(1, Number(payload.totalGuaranteedDraw) || 150);
    if (payload.maxDrawsPerPlayer != null) current.maxDrawsPerPlayer = Math.max(1, Number(payload.maxDrawsPerPlayer) || 5);
    // 重算剩余奖品 = 总奖品 - 实际中奖人数（绝不会出现 17/10 错误）
    const winnersCount = this.listPlayers().players.filter(p => p.hasWon).length;
    current.remainPrize = Math.max(0, current.totalPrize - winnersCount);
    this.storage.set('config', current);
    return { success: true, config: current };
  }

  _queryUserBestAfter(gameId, nickname, afterTimestamp) {
    let result = null;
    this.eventBus.emit('leaderboard:get-user-best-after', { gameId, nickname, afterTimestamp, callback: (r) => { result = r; } });
    return result;
  }

  _queryTopScore(gameId) {
    let result = null;
    this.eventBus.emit('leaderboard:get-top-score', { gameId, callback: (r) => { result = r; } });
    return result || { topScore: 0, total: 0 };
  }

  /**
   * 获取玩家在参与时间之后的有效成绩
   * 第一次查询：after = joinTime；后续查询：after = lastDrawScoreTime
   * 返回 { gameAScore, gameARank, scoreTimeA, gameBScore, gameBRank, scoreTimeB, weight, hasNewA, hasNewB, improvedA, improvedB }
   */
  _fetchScores(player) {
    const isFirstDraw = player.drawCount === 0;
    const afterA = isFirstDraw ? player.joinTime : (player.lastDrawScoreTimeA || player.joinTime);
    const afterB = isFirstDraw ? player.joinTime : (player.lastDrawScoreTimeB || player.joinTime);

    const a = this._queryUserBestAfter(GAME_A, player.gameNickname, afterA);
    const b = this._queryUserBestAfter(GAME_B, player.gameNickname, afterB);

    if (isFirstDraw) {
      if (!a || a.error || a.bestScore == null) return { error: '请先在乱斗前线中游戏并提交成绩', code: 400 };
      if (!b || b.error || b.bestScore == null) return { error: '请先在切斯特牌中游戏并提交成绩', code: 400 };
      const topA = this._queryTopScore(GAME_A);
      const topB = this._queryTopScore(GAME_B);
      const weight = calculateWeight(a.bestScore, a.rank, b.bestScore, b.rank, topA.topScore, topB.topScore);
      return { gameAScore: a.bestScore, gameARank: a.rank, scoreTimeA: a.scoreTime,
               gameBScore: b.bestScore, gameBRank: b.rank, scoreTimeB: b.scoreTime, weight,
               hasNewA: true, hasNewB: true, improvedA: true, improvedB: true };
    }

    // 后续抽奖：只需任一游戏成绩提升即可
    let newScoreA = player.gameAScore, newRankA = player.gameARank, newTimeA = player.currentScoreTimeA || 0;
    let newScoreB = player.gameBScore, newRankB = player.gameBRank, newTimeB = player.currentScoreTimeB || 0;
    let hasNewA = false, hasNewB = false, improvedA = false, improvedB = false;

    if (a && !a.error && a.bestScore != null) {
      hasNewA = true;
      newScoreA = a.bestScore; newRankA = a.rank; newTimeA = a.scoreTime;
      improvedA = a.bestScore > player.lastDrawScoreA;
    }
    if (b && !b.error && b.bestScore != null) {
      hasNewB = true;
      newScoreB = b.bestScore; newRankB = b.rank; newTimeB = b.scoreTime;
      improvedB = b.bestScore > player.lastDrawScoreB;
    }

    if (!improvedA && !improvedB) {
      return { error: '成绩未提升，请在任一游戏中超越上次抽奖成绩后再抽奖', code: 400,
               lastDrawScoreA: player.lastDrawScoreA, lastDrawScoreB: player.lastDrawScoreB };
    }

    const topA = this._queryTopScore(GAME_A);
    const topB = this._queryTopScore(GAME_B);
    const weight = calculateWeight(newScoreA, newRankA, newScoreB, newRankB, topA.topScore, topB.topScore);
    return { gameAScore: newScoreA, gameARank: newRankA, scoreTimeA: newTimeA,
             gameBScore: newScoreB, gameBRank: newRankB, scoreTimeB: newTimeB, weight,
             hasNewA, hasNewB, improvedA, improvedB };
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
    const now = Date.now();
    const player = {
      playerTag: tag, gameNickname: nick, joinTime: now,
      gameAScore: 0, gameARank: null, gameBScore: 0, gameBRank: null,
      currentScoreTimeA: 0, currentScoreTimeB: 0,
      currentWeight: 0,
      lastDrawScoreA: 0, lastDrawScoreB: 0,
      lastDrawScoreTimeA: 0, lastDrawScoreTimeB: 0,
      drawCount: 0, hasWon: false, prizeId: null, winTime: null,
      createdAt: now, lastQueryAt: 0
    };
    this.storage.set('player:' + tag, player);
    this.storage.set(bindKey, { playerTag: tag, boundAt: now });
    this.logger.info('[peak-dual] 绑定: ' + tag + ' → ' + nick + ' (joinTime=' + new Date(now).toISOString() + ')');
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
    const scores = this._fetchScores(player);
    if (scores.error && player.drawCount === 0) {
      logAction(this.storage, tag, { type: 'query', timestamp: Date.now(), ip, ua: getUserAgent(req), result: 'error', error: scores.error });
      return scores;
    }
    // 更新成绩（后续抽奖时若无新成绩，保留旧成绩）
    if (!scores.error) {
      player.gameAScore = scores.gameAScore; player.gameARank = scores.gameARank;
      player.gameBScore = scores.gameBScore; player.gameBRank = scores.gameBRank;
      player.currentScoreTimeA = scores.scoreTimeA; player.currentScoreTimeB = scores.scoreTimeB;
      player.currentWeight = scores.weight;
    }
    player.lastQueryAt = Date.now();
    this.storage.set('player:' + tag, player);
    const logEntry = { type: 'query', timestamp: Date.now(), ip, ua: getUserAgent(req), weight: player.currentWeight, result: 'success' };
    if (scores.error) { logEntry.result = 'error'; logEntry.error = scores.error; logEntry.lastDrawScoreA = player.lastDrawScoreA; logEntry.lastDrawScoreB = player.lastDrawScoreB; }
    logAction(this.storage, tag, logEntry);
    return { success: true, player, config: this.getRuntimeConfig(), scoreInfo: scores.error ? { improved: false, error: scores.error, lastDrawScoreA: player.lastDrawScoreA, lastDrawScoreB: player.lastDrawScoreB } : { improved: scores.improvedA || scores.improvedB } };
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
    const scores = this._fetchScores(player);
    if (scores.error) return scores;
    // 更新成绩
    player.gameAScore = scores.gameAScore; player.gameARank = scores.gameARank;
    player.gameBScore = scores.gameBScore; player.gameBRank = scores.gameBRank;
    player.currentScoreTimeA = scores.scoreTimeA; player.currentScoreTimeB = scores.scoreTimeB;
    player.currentWeight = scores.weight;
    const result = performDraw(player, config);
    // 记录本次抽奖时的成绩快照（用于下次资格判断）
    player.lastDrawScoreA = scores.gameAScore; player.lastDrawScoreB = scores.gameBScore;
    player.lastDrawScoreTimeA = scores.scoreTimeA; player.lastDrawScoreTimeB = scores.scoreTimeB;
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
    logAction(this.storage, tag, { type: 'draw', timestamp: Date.now(), ip, ua: getUserAgent(req), weight: scores.weight, scoreA: scores.gameAScore, scoreB: scores.gameBScore, result: result.won ? 'win' : 'lose', drawCount: player.drawCount, probability: result.probability });
    this.logger.info('[peak-dual] 抽奖: ' + tag + ' → ' + (result.won ? '中奖' : '未中') + ' (p=' + result.probability.toFixed(3) + ')');
    return { success: true, won: result.won, probability: result.probability, isPityDraw: result.isPityDraw, player, config: { remainPrize: config.remainPrize, currentDrawCount: config.currentDrawCount, totalPrize: config.totalPrize, totalGuaranteedDraw: config.totalGuaranteedDraw, maxDrawsPerPlayer: config.maxDrawsPerPlayer } };
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
    // 确保 remainPrize 与实际中奖数一致
    const actualRemain = Math.max(0, config.totalPrize - winners.length);
    if (config.remainPrize !== actualRemain) {
      config.remainPrize = actualRemain;
      this.storage.set('config', config);
    }
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

  /**
   * 活动初始化（非清空）：
   * - 已中奖玩家：保留全部数据，永久不可再参与
   * - 未中奖玩家：保留 drawCount（保底进度），重置成绩/权重/参与时间
   * - 配置：currentDrawCount 归零，remainPrize = totalPrize - winnersCount
   */
  initialize() {
    const config = this.getRuntimeConfig();
    const players = this.listPlayers().players;
    const now = Date.now();
    let winnersCount = 0;
    for (const player of players) {
      if (player.hasWon) {
        winnersCount++;
        continue; // 中奖玩家不动
      }
      // 未中奖玩家：保留 drawCount，重置成绩相关字段
      player.joinTime = now;
      player.gameAScore = 0; player.gameARank = null;
      player.gameBScore = 0; player.gameBRank = null;
      player.currentScoreTimeA = 0; player.currentScoreTimeB = 0;
      player.currentWeight = 0;
      player.lastDrawScoreA = 0; player.lastDrawScoreB = 0;
      player.lastDrawScoreTimeA = 0; player.lastDrawScoreTimeB = 0;
      player.lastQueryAt = 0;
      this.storage.set('player:' + player.playerTag, player);
    }
    config.currentDrawCount = 0;
    config.remainPrize = Math.max(0, config.totalPrize - winnersCount);
    this.storage.set('config', config);
    this.logger.info('[peak-dual] 活动初始化完成: 保留 ' + winnersCount + ' 名中奖者，重置 ' + (players.length - winnersCount) + ' 名未中奖玩家');
    return { success: true, config, winnersCount, resetCount: players.length - winnersCount };
  }
}

module.exports = PeakDualService;
