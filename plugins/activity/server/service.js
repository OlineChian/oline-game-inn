/**
 * 活动系统业务逻辑服务
 * 包含：活动发现、积分管理、预测、抽奖
 */

const fs = require('fs');
const path = require('path');

class ActivityService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = context.config;
    
    // 活动目录
    this.activitiesDir = this.config.activitiesDir || 'activities';
  }

  /**
   * 加载活动配置（自动扫描 activities/ 目录）
   */
  loadActivitiesConfig(basePath) {
    try {
      const dir = path.join(basePath, this.activitiesDir);
      const globalPath = path.join(dir, 'config.json');
      
      let globalConfig = { pointsConfig: {} };
      if (fs.existsSync(globalPath)) {
        globalConfig = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
      }
      
      const activities = [];
      const folders = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const folder of folders) {
        if (folder.isDirectory()) {
          const activityDir = path.join(dir, folder.name);
          const configPath = path.join(activityDir, 'config.json');
          
          if (fs.existsSync(configPath)) {
            try {
              const activityConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              activityConfig.path = `${folder.name}/index.html`;
              if (!activityConfig.id) activityConfig.id = folder.name;
              activities.push(activityConfig);
            } catch (err) {
              this.logger.error(`加载活动失败 ${folder.name}: ${err.message}`);
            }
          }
        }
      }
      
      return { activities, pointsConfig: globalConfig.pointsConfig || {} };
    } catch (err) {
      this.logger.error('加载活动配置失败:', err.message);
      return { activities: [], pointsConfig: {} };
    }
  }

  /**
   * 获取活跃活动列表
   */
  getActiveActivities(basePath) {
    const config = this.loadActivitiesConfig(basePath);
    const now = new Date();
    
    return config.activities.filter(activity => {
      if (!activity.enabled) return false;
      return new Date(activity.endTime) > now;
    });
  }

  /**
   * 获取单个活动详情
   */
  getActivity(activityId, basePath) {
    const config = this.loadActivitiesConfig(basePath);
    return config.activities.find(a => a.id === activityId);
  }

  /**
   * 获取用户积分（从 storage）
   */
  getUserPoints(nickname) {
    const key = `user:${nickname}:points`;
    let points = this.storage.get(key);
    
    if (!points) {
      points = { challenge: 0, prediction: 0, total: 0, history: [] };
      this.storage.set(key, points);
    }
    
    return points;
  }

  /**
   * 更新用户积分（增量模式）
   * 同时同步到 user plugin 的积分系统
   */
  async updateUserPoints(nickname, type, amount, reason) {
    const points = this.getUserPoints(nickname);
    
    if (type === 'challenge') points.challenge += amount;
    else if (type === 'prediction') points.prediction += amount;
    
    points.total = points.challenge + points.prediction;
    
    points.history.push({ type, amount, reason: reason || '', timestamp: Date.now() });
    if (points.history.length > 100) points.history = points.history.slice(-100);
    
    this.storage.set(`user:${nickname}:points`, points);
    
    // 同步到 user plugin（通过 HTTP API，避免直接耦合）
    try {
      const baseUrl = process.env.ACTIVITY_USER_API || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/user/${encodeURIComponent(nickname)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge: points.challenge,
          prediction: points.prediction,
          total: points.total
        })
      });
    } catch (e) {
      this.logger.warn(`同步积分到user plugin失败: ${e.message}`);
    }
    
    return points;
  }

  /**
   * 同步用户积分（全量模式）
   */
  syncUserPoints(nickname, challengePoints, predictionPoints) {
    const points = this.getUserPoints(nickname);
    
    if (challengePoints !== undefined && challengePoints > points.challenge) {
      points.challenge = challengePoints;
    }
    if (predictionPoints !== undefined && predictionPoints > points.prediction) {
      points.prediction = predictionPoints;
    }
    points.total = points.challenge + points.prediction;
    
    points.history.push({ type: 'sync', amount: 0, reason: '客户端同步', timestamp: Date.now() });
    
    this.storage.set(`user:${nickname}:points`, points);
    this.eventBus.emit('points:updated', { nickname, points });
    
    return points;
  }

  /**
   * 提交预测
   */
  async submitPrediction(activityId, nickname, data) {
    const key = `prediction:${activityId}:${nickname}`;
    const existing = this.storage.get(key);
    
    // 多场对阵预测格式
    if (data.predictions && typeof data.predictions === 'object') {
      const isUpdate = !!existing;
      const predictionCount = Object.keys(data.predictions).length;
      
      this.storage.set(key, {
        nickname,
        matchPredictions: data.predictions,
        champion: data.champion || '',
        score: data.score || '',
        mvp: data.mvp || '',
        submittedAt: Date.now(),
        predictionCount: predictionCount,
        participated: true
      });
      
      // 获取活动配置
      const basePath = path.join(__dirname, '..', '..', '..');
      const config = this.loadActivitiesConfig(basePath);
      const activity = config.activities.find(a => a.id === activityId);
      const participateReward = activity && activity.prediction ? activity.prediction.participateReward || 5 : 5;
      
      // 首次提交时发放参与积分（每场5积分）
      if (!isUpdate && predictionCount > 0) {
        const pointsToAward = predictionCount * participateReward;
        await this.updateUserPoints(nickname, 'prediction', pointsToAward, `预测参与奖励（${predictionCount}场）`);
        return { 
          success: true, 
          message: `预测提交成功！获得 ${pointsToAward} 参与积分`,
          pointsAwarded: pointsToAward
        };
      }
      
      // 更新时不重复发放积分
      return { success: true, message: '预测已更新', pointsAwarded: 0 };
    }
    
    // 单个冠军预测格式
    if (!data.champion) {
      return { error: '参数不完整', code: 400 };
    }
    
    if (existing) {
      return { error: '您已经提交过预测了', code: 400 };
    }
    
    this.storage.set(key, {
      nickname,
      champion: data.champion,
      score: data.score || '',
      mvp: data.mvp || '',
      submittedAt: Date.now(),
      participated: true
    });
    
    // 首次提交时发放参与积分
    const basePath = path.join(__dirname, '..', '..', '..');
    const config = this.loadActivitiesConfig(basePath);
    const activity = config.activities.find(a => a.id === activityId);
    const participateReward = activity && activity.prediction ? activity.prediction.participateReward || 5 : 5;
    
    await this.updateUserPoints(nickname, 'prediction', participateReward, '预测参与奖励');
    return { 
      success: true, 
      message: `预测提交成功！获得 ${participateReward} 参与积分`,
      pointsAwarded: participateReward
    };
  }

  /**
   * 结算预测积分（活动结束后调用）
   * 根据预测正确数量发放积分
   */
  async settlePrediction(activityId, nickname, results) {
    const key = `prediction:${activityId}:${nickname}`;
    const prediction = this.storage.get(key);
    if (!prediction) return { error: '无预测记录', code: 404 };

    const basePath = path.join(__dirname, '..', '..', '..');
    const config = this.loadActivitiesConfig(basePath);
    const activity = config.activities.find(a => a.id === activityId);
    if (!activity || !activity.prediction) return { error: '活动配置不存在', code: 400 };

    const rewardPerCorrect = activity.prediction.reward || 25; // 每场正确奖励
    let correctCount = 0;
    let totalCount = 0;

    // 计算对阵预测正确数量
    if (prediction.matchPredictions && results.matchResults) {
      for (const [matchId, correctWinner] of Object.entries(results.matchResults)) {
        totalCount++;
        if (prediction.matchPredictions[matchId] === correctWinner) {
          correctCount++;
        }
      }
    }

    const points = correctCount * rewardPerCorrect;
    
    // 如果已有结算记录，不重复发放
    if (prediction.settled) {
      return { success: true, message: '预测已结算过', correctCount, totalCount, points: 0 };
    }

    if (points > 0) {
      await this.updateUserPoints(nickname, 'prediction', points, `预测结算（${correctCount}/${totalCount}场正确）`);
    }

    // 标记为已结算
    prediction.settled = true;
    prediction.settledAt = Date.now();
    prediction.correctCount = correctCount;
    prediction.totalCount = totalCount;
    prediction.pointsAwarded = points;
    this.storage.set(key, prediction);

    return { success: true, correctCount, totalCount, points, message: `结算完成：${correctCount}/${totalCount}场正确，获得${points}积分` };
  }

  /**
   * 批量结算所有用户的预测（管理员用）
   */
  settleAllPredictions(activityId, results) {
    const basePath = path.join(__dirname, '..', '..', '..');
    const config = this.loadActivitiesConfig(basePath);
    const activity = config.activities.find(a => a.id === activityId);
    if (!activity) return { error: '活动不存在', code: 400 };

    const allKeys = Array.from(this.storage.store.keys()).filter(k => k.startsWith(`prediction:${activityId}:`));
    const settled = [];
    const failed = [];

    for (const key of allKeys) {
      const nickname = key.split(':')[2];
      const result = this.settlePrediction(activityId, nickname, results);
      if (result.success) {
        settled.push({ nickname, ...result });
      } else {
        failed.push({ nickname, error: result.error });
      }
    }

    return { success: true, settled: settled.length, failed: failed.length, details: { settled, failed } };
  }

  /**
   * 获取预测记录
   */
  getPrediction(activityId, nickname) {
    const key = `prediction:${activityId}:${nickname}`;
    return this.storage.get(key) || null;
  }

  /**
   * 抽奖
   */
  /**
   * 创建挑战 Session
   */
  createChallengeSession(nickname, activityId, gameId) {
    const id = `${nickname}_${activityId}_${gameId}_${Date.now()}`;
    const session = {
      id,
      nickname,
      activityId,
      gameId,
      scores: [],       // 所有局成绩
      status: 'active', // active | completed | expired
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000 // 30分钟后过期
    };
    this.storage.set(`challenge:session:${id}`, session);
    return session;
  }

  /**
   * 提交单局成绩
   */
  async submitChallengeScore(sessionId, score) {
    const session = this.storage.get(`challenge:session:${sessionId}`);
    if (!session) return { error: 'Session不存在', code: 404 };
    if (session.status !== 'active') return { error: 'Session已结束', code: 400 };
    if (Date.now() > session.expiresAt) {
      session.status = 'expired';
      this.storage.set(`challenge:session:${sessionId}`, session);
      return { error: 'Session已过期', code: 400 };
    }

    session.scores.push(score);
    this.storage.set(`challenge:session:${sessionId}`, session);

    // 3局后自动结束
    if (session.scores.length >= 3) {
      session.status = 'completed';
      const bestScore = Math.max(...session.scores);
      session.bestScore = bestScore;
      this.storage.set(`challenge:session:${sessionId}`, session);

      // 自动结算积分
      await this._settleChallengeScore(session, bestScore);
    }

    return {
      success: true,
      scores: session.scores,
      totalRounds: session.scores.length,
      status: session.status,
      bestScore: session.bestScore || null
    };
  }

  /**
   * 获取 Session
   */
  getChallengeSession(sessionId) {
    const session = this.storage.get(`challenge:session:${sessionId}`);
    if (!session) return null;
    // 过期检查
    if (Date.now() > session.expiresAt && session.status === 'active') {
      session.status = 'expired';
      this.storage.set(`challenge:session:${sessionId}`, session);
    }
    return session;
  }

  /**
   * 结算挑战积分
   */
  async _settleChallengeScore(session, bestScore) {
    const basePath = path.join(__dirname, '..', '..', '..');
    const config = this.loadActivitiesConfig(basePath);
    const activity = config.activities.find(a => a.id === session.activityId);
    if (!activity || !activity.challenge) return;

    const game = activity.challenge.games.find(g => g.id === session.gameId);
    if (!game) return;

    let points = 0;
    if (game.sort === 'asc') {
      points = bestScore > 0 ? Math.round((game.maxScore / bestScore) * 50) : 0;
    } else {
      let capped = game.scoreCap ? Math.min(bestScore, game.scoreCap) : bestScore;
      points = Math.round((capped / game.maxScore) * 100);
    }
    points = Math.round(points * (activity.challenge.rewardMultiplier || 1));
    points = Math.min(points, game.maxScore);

    // 累加到用户积分（取最高分，不覆盖）
    const existingKey = `challenge:${session.nickname}:${session.gameId}:best`;
    const existingBest = this.storage.get(existingKey) || 0;
    if (points > existingBest) {
      this.storage.set(existingKey, points);
      const delta = points - existingBest;
      if (delta > 0) {
        await this.updateUserPoints(session.nickname, 'challenge', delta, `${game.name}挑战结算`);
      }
    }
  }

  /**
   * 获取用户各游戏的挑战最佳成绩
   */
  getUserChallengeBest(nickname, activityId) {
    const basePath = path.join(__dirname, '..', '..', '..');
    const config = this.loadActivitiesConfig(basePath);
    const activity = config.activities.find(a => a.id === (activityId || config.activities[0]?.id));
    if (!activity || !activity.challenge) return {};

    const result = {};
    for (const game of activity.challenge.games) {
      const key = `challenge:${nickname}:${game.id}:best`;
      const best = this.storage.get(key);
      if (best !== undefined && best !== null) {
        result[game.id] = {
          gameId: game.id,
          bestScore: best,
          completed: true
        };
      } else {
        result[game.id] = {
          gameId: game.id,
          bestScore: null,
          completed: false
        };
      }
    }
    return result;
  }

  lotteryDraw(nickname, activityId) {
    const points = this.getUserPoints(nickname);
    const cost = 50;
    
    if (points.total < cost) {
      return { error: '积分不足', code: 400 };
    }
    
    // 按比例扣除积分
    const challengeRatio = points.challenge / (points.challenge + points.prediction) || 0.6;
    const predictionRatio = 1 - challengeRatio;
    
    points.total -= cost;
    points.challenge = Math.max(0, Math.floor(points.challenge - cost * challengeRatio));
    points.prediction = Math.max(0, Math.floor(points.prediction - cost * predictionRatio));
    
    points.history.push({ type: 'lottery', amount: -cost, reason: '宝石抽奖', timestamp: Date.now() });
    this.storage.set(`user:${nickname}:points`, points);
    
    // 奖品池
    const prizePool = [
      { name: '30宝石', probability: 0.30 },
      { name: '50宝石', probability: 0.20 },
      { name: '100宝石', probability: 0.15 },
      { name: '200宝石', probability: 0.10 },
      { name: '皮肤宝箱', probability: 0.10 },
      { name: '限定头像框', probability: 0.08 },
      { name: '限定皮肤', probability: 0.05 },
      { name: '再来一次', probability: 0.02 }
    ];
    
    // 加权随机抽奖
    const random = Math.random();
    let cumulative = 0;
    let prize = prizePool[0];
    
    for (const p of prizePool) {
      cumulative += p.probability;
      if (random <= cumulative) { prize = p; break; }
    }
    
    // "再来一次"返还积分
    if (prize.name === '再来一次') {
      points.total += cost;
      points.challenge = Math.floor(points.challenge + cost * challengeRatio);
      points.prediction = Math.floor(points.prediction + cost * predictionRatio);
      this.storage.set(`user:${nickname}:points`, points);
    }
    
    this.eventBus.emit('lottery:drawn', { nickname, prize: prize.name, activityId });
    
    return { success: true, prize: prize.name, remainingPoints: points.total };
  }
}

module.exports = ActivityService;