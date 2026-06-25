/**
 * 用户系统业务逻辑服务
 * 包含：积分管理、挑战记录
 */

class UserService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = context.config;
    
    this.maxHistory = this.config.maxHistoryLength || 100;
  }

  /**
   * 获取用户积分
   */
  getPoints(nickname) {
    const key = `points:${nickname}`;
    let points = this.storage.get(key);
    
    if (!points) {
      points = { challenge: 0, prediction: 0, total: 0, history: [] };
      this.storage.set(key, points);
    }
    
    return points;
  }

  /**
   * 更新用户积分（增量模式）
   */
  updatePoints(nickname, type, amount, reason) {
    const points = this.getPoints(nickname);
    
    if (type === 'challenge') points.challenge += amount;
    else if (type === 'prediction') points.prediction += amount;
    
    points.total = points.challenge + points.prediction;
    
    points.history.push({ type, amount, reason: reason || '', timestamp: Date.now() });
    if (points.history.length > this.maxHistory) {
      points.history = points.history.slice(-this.maxHistory);
    }
    
    this.storage.set(`points:${nickname}`, points);
    
    // 发布积分变更事件
    this.eventBus.emit('points:updated', { nickname, points, type, amount });
    
    return points;
  }

  /**
   * 同步用户积分（全量模式）
   */
  syncPoints(nickname, challengePoints, predictionPoints) {
    const points = this.getPoints(nickname);
    
    if (challengePoints !== undefined && challengePoints > points.challenge) {
      points.challenge = challengePoints;
    }
    if (predictionPoints !== undefined && predictionPoints > points.prediction) {
      points.prediction = predictionPoints;
    }
    points.total = points.challenge + points.prediction;
    
    points.history.push({ type: 'sync', amount: 0, reason: '客户端同步', timestamp: Date.now() });
    
    this.storage.set(`points:${nickname}`, points);
    this.eventBus.emit('points:updated', { nickname, points });
    
    return points;
  }

  /**
   * 检查挑战是否已完成
   */
  hasCompletedChallenge(nickname, gameId) {
    const key = `challenge:${nickname}:${gameId}`;
    return this.storage.has(key);
  }

  /**
   * 标记挑战已完成
   */
  markChallengeCompleted(nickname, gameId) {
    const key = `challenge:${nickname}:${gameId}`;
    this.storage.set(key, true);
    this.eventBus.emit('challenge:marked', { nickname, gameId });
  }

  /**
   * 扣除积分（抽奖等）
   */
  deductPoints(nickname, amount, reason) {
    const points = this.getPoints(nickname);
    
    if (points.total < amount) {
      return { error: '积分不足', code: 400 };
    }
    
    // 按比例从 challenge 和 prediction 中扣除
    const challengeRatio = points.challenge / (points.challenge + points.prediction) || 0.6;
    const predictionRatio = 1 - challengeRatio;
    
    points.total -= amount;
    points.challenge = Math.max(0, Math.floor(points.challenge - amount * challengeRatio));
    points.prediction = Math.max(0, Math.floor(points.prediction - amount * predictionRatio));
    
    points.history.push({ type: 'deduct', amount: -amount, reason, timestamp: Date.now() });
    
    this.storage.set(`points:${nickname}`, points);
    this.eventBus.emit('points:updated', { nickname, points });
    
    return { success: true, points };
  }

  /**
   * 返还积分（如抽奖"再来一次")
   */
  refundPoints(nickname, amount, reason) {
    const points = this.getPoints(nickname);
    
    const challengeRatio = 0.6; // 默认返还比例
    const predictionRatio = 0.4;
    
    points.total += amount;
    points.challenge = Math.floor(points.challenge + amount * challengeRatio);
    points.prediction = Math.floor(points.prediction + amount * predictionRatio);
    
    points.history.push({ type: 'refund', amount, reason, timestamp: Date.now() });
    
    this.storage.set(`points:${nickname}`, points);
    this.eventBus.emit('points:updated', { nickname, points });
    
    return points;
  }
}

module.exports = UserService;