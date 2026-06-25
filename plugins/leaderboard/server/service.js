/**
 * 排行榜业务逻辑服务
 * 从 server.js 抽取，保持 API 返回格式完全一致
 */

class LeaderboardService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = context.config;
    
    // 使用分区存储保存排行榜数据
    this.boardKey = 'records';
  }

  /**
   * 获取游戏配置（从站点配置读取）
   */
  getGameConfigs(siteConfig) {
    const configs = {};
    if (siteConfig && siteConfig.games) {
      for (const game of siteConfig.games) {
        if (game.leaderboard) {
          configs[game.id] = game.leaderboard;
        }
      }
    }
    return configs;
  }

  /**
   * 获取游戏列表
   */
  getGamesList(siteConfig) {
    return siteConfig?.games || [];
  }

  /**
   * 获取挑战配置
   */
  getChallengeConfig(siteConfig) {
    return siteConfig?.challenges || {};
  }

  /**
   * 获取排行榜数据（自动初始化）
   */
  getBoard(gameId) {
    const key = `${gameId}:${this.boardKey}`;
    let board = this.storage.get(key);
    if (!board) {
      board = [];
      this.storage.set(key, board);
    }
    return board;
  }

  /**
   * 获取排行榜概览
   */
  getLeaderboardOverview(gameId, siteConfig) {
    const gameConfigs = this.getGameConfigs(siteConfig);
    const config = gameConfigs[gameId];
    
    if (!config) {
      return null;
    }
    
    const board = this.getBoard(gameId);
    const sorted = this.sortBoard(board, config.sort);
    
    return {
      config,
      top3: sorted.slice(0, 3),
      total: board.length
    };
  }

  /**
   * 获取排行榜详情
   */
  getLeaderboard(gameId, options, siteConfig) {
    const { limit = 10, difficulty, hardestOnly } = options;
    const gameConfigs = this.getGameConfigs(siteConfig);
    const config = gameConfigs[gameId];
    
    if (!config) {
      return { error: '游戏不存在', code: 404 };
    }
    
    const board = this.getBoard(gameId);
    let filtered = [...board];
    
    // 筛选逻辑
    if (hardestOnly) {
      filtered = this.filterHardest(board, config);
    } else if (difficulty) {
      filtered = board.filter(r => r.extra?.difficulty === difficulty);
    }
    
    // 排序
    const sorted = this.sortBoard(filtered, config.sort);
    
    // 收集可用难度列表
    const availableDifficulties = this.collectDifficulties(board);
    
    return {
      success: true,
      game: gameId,
      config,
      leaderboard: sorted.slice(0, limit),
      total: filtered.length,
      allTotal: board.length,
      difficulty: difficulty || (hardestOnly ? 'hardest' : null),
      availableDifficulties
    };
  }

  /**
   * 提交成绩
   */
  submitScore(gameId, data, siteConfig, userPoints, completedChallenges) {
    const { nickname, score, extra } = data;
    const gameConfigs = this.getGameConfigs(siteConfig);
    const config = gameConfigs[gameId];
    
    if (!config) {
      return { error: '游戏不存在', code: 404 };
    }
    
    if (!nickname || !score) {
      return { error: '昵称和分数不能为空', code: 400 };
    }
    
    const board = this.getBoard(gameId);
    
    const record = {
      nickname: String(nickname).slice(0, 20),
      score: Number(score),
      extra: extra || {},
      timestamp: Date.now()
    };
    
    board.push(record);
    
    // 计算排名
    const sorted = this.sortBoard(board, config.sort);
    const rank = sorted.findIndex(r => r.timestamp === record.timestamp) + 1;
    
    // 挑战积分结算（发布事件）
    let challengeReward = null;
    const challengeKey = `${nickname}_${gameId}`;
    const challengeConfig = this.getChallengeConfig(siteConfig);
    const challenge = challengeConfig[gameId];
    
    if (challenge && !completedChallenges.has(challengeKey)) {
      const userScores = board.filter(r => r.nickname === nickname);
      let bestScore = score;
      
      if (userScores.length > 0) {
        bestScore = config.sort === 'desc'
          ? Math.max(...userScores.map(r => r.score))
          : Math.min(...userScores.map(r => r.score));
      }
      
      const isCompleted = config.sort === 'desc'
        ? bestScore >= challenge.target
        : bestScore <= challenge.target;
      
      if (isCompleted) {
        // 发布挑战完成事件（由 User 插件或旧系统处理）
        this.eventBus.emit('challenge:completed', {
          nickname,
          gameId,
          challenge,
          bestScore
        });
        
        challengeReward = {
          name: challenge.name,
          reward: challenge.reward
        };
      }
    }
    
    return {
      success: true,
      rank,
      total: board.length,
      record,
      challengeReward
    };
  }

  /**
   * 排序排行榜
   */
  sortBoard(board, sortType) {
    return [...board].sort((a, b) => {
      return sortType === 'desc' ? b.score - a.score : a.score - b.score;
    });
  }

  /**
   * 筛选最难难度
   */
  filterHardest(board, config) {
    const diffRank = { 'hard': 3, 'normal': 2, 'easy': 1 };
    const playerBest = {};
    
    for (const record of board) {
      const rDiff = record.extra?.difficulty || '';
      const rank = diffRank[rDiff] || 0;
      const key = record.nickname;
      
      const existingDiff = playerBest[key]?.extra?.difficulty || '';
      const existingRank = diffRank[existingDiff] || 0;
      
      if (!playerBest[key] || rank > existingRank) {
        playerBest[key] = record;
      } else if (rank === existingRank && rank > 0) {
        const isBetter = config.sort === 'desc'
          ? record.score > playerBest[key].score
          : record.score < playerBest[key].score;
        if (isBetter) playerBest[key] = record;
      }
    }
    
    return Object.values(playerBest);
  }

  /**
   * 收集可用难度列表
   */
  collectDifficulties(board) {
    const diffSet = new Set();
    const result = [];
    
    for (const record of board) {
      const d = record.extra?.difficulty;
      if (d && !diffSet.has(d)) {
        diffSet.add(d);
        result.push(d);
      }
    }
    
    const diffOrder = { 'easy': 0, 'normal': 1, 'hard': 2 };
    result.sort((a, b) => (diffOrder[b] || 0) - (diffOrder[a] || 0));
    
    return result;
  }
}

module.exports = LeaderboardService;