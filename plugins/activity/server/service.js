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
   */
  updateUserPoints(nickname, type, amount, reason) {
    const points = this.getUserPoints(nickname);
    
    if (type === 'challenge') points.challenge += amount;
    else if (type === 'prediction') points.prediction += amount;
    
    points.total = points.challenge + points.prediction;
    
    points.history.push({ type, amount, reason: reason || '', timestamp: Date.now() });
    if (points.history.length > 100) points.history = points.history.slice(-100);
    
    this.storage.set(`user:${nickname}:points`, points);
    
    // 发布积分变更事件
    this.eventBus.emit('points:updated', { nickname, points });
    
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
  submitPrediction(activityId, nickname, data) {
    const key = `prediction:${activityId}:${nickname}`;
    const existing = this.storage.get(key);
    
    // 多场对阵预测格式
    if (data.predictions && typeof data.predictions === 'object') {
      const isUpdate = !!existing;
      
      this.storage.set(key, {
        nickname,
        matchPredictions: data.predictions,
        champion: data.champion || '',
        score: data.score || '',
        mvp: data.mvp || '',
        submittedAt: Date.now()
      });
      
      // 首次提交奖励积分
      if (!isUpdate) {
        this.updateUserPoints(nickname, 'prediction', 10, '参与赛事预测');
        this.logger.info(`${nickname} 提交预测，获得10积分`);
      }
      
      return { success: true, message: isUpdate ? '预测已更新' : '预测提交成功，获得10预测积分！' };
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
      submittedAt: Date.now()
    });
    
    this.updateUserPoints(nickname, 'prediction', 10, '参与赛事预测');
    
    return { success: true, message: '预测提交成功，获得10预测积分！' };
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