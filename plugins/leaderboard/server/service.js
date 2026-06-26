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
   *
   * 防御：若 storage 中的数据因历史 PostgresStore JSONB 序列化 bug 损坏为 `{}`
   * 或其他非 Array 类型，重置为空数组并写回，避免下游 `[...board]` 抛
   * "board is not iterable" 导致 API 500。写回会触发 dirty → UPSERT，
   * 顺带修复 Supabase 中的损坏数据。
   */
  getBoard(gameId) {
    const key = `${gameId}:${this.boardKey}`;
    let board = this.storage.get(key);
    if (!Array.isArray(board)) {
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
    const aggregated = this.aggregateByConfig(sorted, config);

    return {
      config,
      top3: aggregated.slice(0, 3),
      total: aggregated.length
    };
  }

  /**
   * 获取用户在指定游戏的最佳成绩
   */
  getUserBest(gameId, nickname, siteConfig) {
    const gameConfigs = this.getGameConfigs(siteConfig);
    const config = gameConfigs[gameId];
    if (!config) return { error: '游戏不存在' };

    const board = this.getBoard(gameId);
    const userRecords = board.filter(r => r.nickname === nickname);
    if (userRecords.length === 0) return { error: '暂无记录', bestScore: null, rank: null, total: board.length };

    // sum 聚合模式：bestScore 为该玩家所有记录的求和
    if (config.aggregate === 'sum') {
      const totalScore = userRecords.reduce((s, r) => s + (Number(r.score) || 0), 0);
      const aggregated = this.aggregateByConfig(this.sortBoard(board, config.sort), config);
      const rank = aggregated.findIndex(r => r.nickname === nickname) + 1;
      return {
        gameId,
        nickname,
        bestScore: totalScore,
        rank: rank || null,
        total: aggregated.length,
        config,
        extra: userRecords[userRecords.length - 1].extra || {},
        playedCount: userRecords.length
      };
    }

    const sorted = this.sortBoard(board, config.sort);
    const best = config.sort === 'asc'
      ? userRecords.reduce((a, b) => a.score < b.score ? a : b)
      : userRecords.reduce((a, b) => a.score > b.score ? a : b);
    const rank = sorted.findIndex(r => r.nickname === nickname && r.score === best.score) + 1;

    return {
      gameId,
      nickname,
      bestScore: best.score,
      rank: rank || null,
      total: board.length,
      config,
      extra: best.extra || {},
      playedCount: userRecords.length
    };
  }

  /**
   * 获取排行榜详情
   * mode:
   *   - 'history'：返回全部历史记录（不按昵称聚合），用于“查看全部历史成绩”
   *   - 默认：按 config.aggregate 聚合（dedupe 保留最佳 / sum 累加求和）
   */
  getLeaderboard(gameId, options, siteConfig) {
    const { limit = 10, difficulty, hardestOnly, mode } = options;
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

    // history 模式：跳过聚合，保留每一条历史记录
    // 默认模式：按配置聚合（dedupe 保留最佳 / sum 累加求和）
    const aggregated = mode === 'history' ? sorted : this.aggregateByConfig(sorted, config);

    return {
      success: true,
      game: gameId,
      config,
      mode: mode === 'history' ? 'history' : (config.aggregate === 'sum' ? 'sum' : 'best'),
      leaderboard: aggregated.slice(0, limit),
      total: aggregated.length,
      allTotal: board.length,
      difficulty: difficulty || (hardestOnly ? 'hardest' : null),
      availableDifficulties
    };
  }

  /**
   * 根据 config.aggregate 选择聚合策略
   * - 'sum'：按昵称合并并求和 score（用于累计计数场景，如胜场）
   *   求和后分数为累计值，必须按 sortType 重新排序，
   *   否则保留的是首条记录在原数组中的位置（按单局分数排序），胜场数多者不会排在前面。
   * - 默认：按昵称去重，保留排序后的首条（最佳）记录（已按单局分数排序，无需重排）
   */
  aggregateByConfig(sortedRecords, config) {
    if (config && config.aggregate === 'sum') {
      const summed = this.sumByNickname(sortedRecords);
      return this.sortBoard(summed, config.sort);
    }
    return this.dedupeByNickname(sortedRecords);
  }

  /**
   * 按昵称合并记录并求和 score（保留最新 extra 用于展示难度等元信息）
   */
  sumByNickname(sortedRecords) {
    const map = new Map();
    for (const r of sortedRecords) {
      const existing = map.get(r.nickname);
      if (existing) {
        existing.score = (Number(existing.score) || 0) + (Number(r.score) || 0);
        if (r.extra) existing.extra = { ...r.extra };
        existing.timestamp = r.timestamp;
      } else {
        map.set(r.nickname, { ...r });
      }
    }
    return Array.from(map.values());
  }

  /**
   * 按昵称去重，保留每个玩家排序后的首条（最佳）记录
   */
  dedupeByNickname(sortedRecords) {
    const seen = new Set();
    const result = [];
    for (const record of sortedRecords) {
      if (!seen.has(record.nickname)) {
        seen.add(record.nickname);
        result.push(record);
      }
    }
    return result;
  }

  /**
   * 提交成绩
   * 注意：排行榜只负责成绩存储与排名，不再自动结算挑战积分。
   * 挑战积分由活动中心的挑战 Session 流程独立结算
   * （createChallengeSession → submitChallengeScore → _settleChallengeScore），
   * 该流程要求用户从活动中心进入并持有 challengeSessionId，避免"未参与挑战即加分"。
   */
  submitScore(gameId, data, siteConfig) {
    const { nickname, score, extra } = data;
    const gameConfigs = this.getGameConfigs(siteConfig);
    const config = gameConfigs[gameId];

    if (!config) {
      return { error: '游戏不存在', code: 404 };
    }

    // 修复：原 `!score` 会误拦 score=0；改为显式空值判断，允许 0 分提交
    if (!nickname || score === undefined || score === null) {
      return { error: '昵称和分数不能为空', code: 400 };
    }

    const scoreNum = Number(score);
    if (!Number.isFinite(scoreNum)) {
      return { error: '分数格式错误', code: 400 };
    }

    // 分数合理性校验：挡住明显离谱的伪造高分（scoreCap/scoreFloor 来自 config）
    if (typeof config.scoreCap === 'number' && scoreNum > config.scoreCap) {
      return { error: '分数超出合理范围', code: 400 };
    }
    if (typeof config.scoreFloor === 'number' && scoreNum < config.scoreFloor) {
      return { error: '分数低于合理范围', code: 400 };
    }

    const key = `${gameId}:${this.boardKey}`;
    const board = this.getBoard(gameId);

    const record = {
      nickname: String(nickname).slice(0, 20),
      score: scoreNum,
      extra: extra || {},
      timestamp: Date.now()
    };

    board.push(record);
    // 触发 dirty 标记，确保 PostgresStore 增量落盘能 flush 该 key。
    // FileStore 全量落盘会顺带写入内存修改，但 PostgresStore 只 flush 被 set
    // 标记过的 key；漏调 set 会导致新成绩仅存内存、不进 Supabase，重新部署后丢失。
    this.storage.set(key, board);

    // 计算排名
    const sorted = this.sortBoard(board, config.sort);
    const rank = sorted.findIndex(r => r.timestamp === record.timestamp) + 1;

    return {
      success: true,
      rank,
      total: board.length,
      record
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
   * 删除一条记录（管理员操作，按 timestamp 定位）
   */
  deleteRecord(gameId, timestamp, siteConfig) {
    const gameConfigs = this.getGameConfigs(siteConfig);
    if (!gameConfigs[gameId]) {
      return { error: '游戏不存在', code: 404 };
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return { error: 'timestamp 格式错误', code: 400 };
    }

    const key = `${gameId}:${this.boardKey}`;
    const board = this.getBoard(gameId);
    const before = board.length;
    const filtered = board.filter(r => Number(r.timestamp) !== ts);

    if (filtered.length === before) {
      return { error: '未找到该记录', code: 404 };
    }

    this.storage.set(key, filtered);
    return { success: true, remaining: filtered.length };
  }

  /**
   * 修改一条记录（管理员操作，按 timestamp 定位）
   * 仅更新传入的字段（nickname/score/extra）
   */
  updateRecord(gameId, timestamp, updates, siteConfig) {
    const gameConfigs = this.getGameConfigs(siteConfig);
    if (!gameConfigs[gameId]) {
      return { error: '游戏不存在', code: 404 };
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return { error: 'timestamp 格式错误', code: 400 };
    }

    const key = `${gameId}:${this.boardKey}`;
    const board = this.getBoard(gameId);
    const record = board.find(r => Number(r.timestamp) === ts);
    if (!record) {
      return { error: '未找到该记录', code: 404 };
    }

    if (updates.nickname !== undefined) {
      record.nickname = String(updates.nickname).slice(0, 20);
    }
    if (updates.score !== undefined) {
      const scoreNum = Number(updates.score);
      if (!Number.isFinite(scoreNum)) {
        return { error: '分数格式错误', code: 400 };
      }
      record.score = scoreNum;
    }
    if (updates.extra !== undefined) {
      record.extra = updates.extra || {};
    }

    this.storage.set(key, board);
    return { success: true, record };
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