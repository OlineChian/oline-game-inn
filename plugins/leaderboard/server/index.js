/**
 * 排行榜插件入口
 * 注册 API 路由，提供排行榜服务
 */

const LeaderboardService = require('./service');
const { verifySubmission, verifyAntiCheat } = require('./security');
const { checkAdminAuth } = require('../../../core/server/admin-routes');
const fs = require('fs');
const path = require('path');

module.exports = function(app, context) {
  const service = new LeaderboardService(context);
  
  let siteConfig = {};
  const siteConfigPath = path.join(__dirname, '..', '..', '..', 'config', 'site.json');
  try {
    if (fs.existsSync(siteConfigPath)) {
      siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
    }
  } catch (e) {
    context.logger.warn('Failed to load site config: ' + e.message);
  }

  function getGameListFromPlugins() {
    if (!context.pluginManager || !context.pluginManager.getGamePlugins) {
      return [];
    }
    return context.pluginManager.getGamePlugins();
  }

  function getMergedGames() {
    const pluginGames = getGameListFromPlugins();
    const siteGames = (siteConfig.games || []).reduce((map, g) => {
      map[g.id] = g;
      return map;
    }, {});
    
    const merged = [];
    for (const pg of pluginGames) {
      const siteGame = siteGames[pg.id] || {};
      merged.push({
        id: pg.id,
        name: siteGame.name || pg.name || pg.id,
        icon: siteGame.icon || pg.icon || '🎮',
        description: siteGame.description || pg.description || '',
        tag: siteGame.tag || '休闲游戏',
        tagClass: siteGame.tagClass || 'tag-default',
        isOnline: siteGame.isOnline || pg.meta?.type === 'game' && pg.meta?.online || false,
        showOnHome: siteGame.showOnHome !== false,
        leaderboard: siteGame.leaderboard || pg.meta?.leaderboard || { sort: 'desc', unit: '分', label: '得分' }
      });
      delete siteGames[pg.id];
    }
    
    for (const [id, sg] of Object.entries(siteGames)) {
      merged.push({
        id,
        name: sg.name,
        icon: sg.icon || '🎮',
        description: sg.description || '',
        tag: sg.tag || '休闲游戏',
        tagClass: sg.tagClass || 'tag-default',
        isOnline: sg.isOnline || false,
        showOnHome: sg.showOnHome !== false,
        leaderboard: sg.leaderboard || { sort: 'desc', unit: '分', label: '得分' }
      });
    }
    
    return merged;
  }

  if (app) {
    app.get('/api/games', (req, res) => {
      const showAll = req.query.all === 'true';
      let games = getMergedGames();
      if (!showAll) {
        games = games.filter(g => g.showOnHome !== false);
      }
      res.json({
        success: true,
        games: games,
        total: games.length
      });
    });

    app.get('/api/leaderboard/:game', (req, res) => {
      const gameId = req.params.game;
      const limit = parseInt(req.query.limit) || 10;
      const difficulty = req.query.difficulty;
      const hardestOnly = req.query.hardestOnly === 'true';
      const mode = req.query.mode;

      const result = service.getLeaderboard(gameId, { limit, difficulty, hardestOnly, mode }, siteConfig);

      if (result.code === 404) {
        return res.status(404).json({ success: false, error: result.error });
      }
      res.json(result);
    });

    app.get('/api/leaderboards', (req, res) => {
      const result = {};
      const gameConfigs = service.getGameConfigs(siteConfig);
      
      for (const [gameId] of Object.entries(gameConfigs)) {
        result[gameId] = service.getLeaderboardOverview(gameId, siteConfig);
      }
      
      res.json({ success: true, leaderboards: result });
    });

    // 获取指定用户在指定游戏的最佳成绩
    app.get('/api/leaderboard/:game/user/:nickname', (req, res) => {
      const { game, nickname } = req.params;
      const data = service.getUserBest(game, decodeURIComponent(nickname), siteConfig);
      if (data.error) return res.status(404).json({ success: false, error: data.error });
      res.json({ success: true, ...data });
    });

    app.post('/api/leaderboard/:game', (req, res) => {
      const gameId = req.params.game;
      const { nickname, score, extra } = req.body;

      // 安全校验：HMAC 签名 + 时间窗口 + nonce 防重放
      // 历史数据保留不动；新提交必须携带合法签名，否则拒绝
      const verification = verifySubmission(gameId, req.body);
      if (!verification.ok) {
        return res.status(verification.code).json({ success: false, error: verification.error });
      }

      // 反作弊校验：防 AFK / 障碍物删除刷分（仅当 extra.antiCheat 存在时校验，向后兼容未接入的游戏）
      const acCheck = verifyAntiCheat(gameId, req.body);
      if (!acCheck.ok) {
        return res.status(acCheck.code).json({ success: false, error: acCheck.error });
      }

      // 排行榜只存储成绩与排名；挑战积分由活动中心 Session 流程独立结算
      const result = service.submitScore(gameId, { nickname, score, extra }, siteConfig);

      if (result.code === 404) {
        return res.status(404).json({ success: false, error: result.error });
      }
      if (result.code === 400) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json(result);
    });

    // ===== 管理员操作路由（删除/修改记录）=====
    // 鉴权：可选 ADMIN_TOKEN（未设则仅靠 URL 隐藏）

    // 删除一条记录 DELETE /api/leaderboard/:game/record?timestamp=xxx
    app.delete('/api/leaderboard/:game/record', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const gameId = req.params.game;
      const timestamp = req.query.timestamp;
      const result = service.deleteRecord(gameId, timestamp, siteConfig);
      if (result.code === 404) {
        return res.status(404).json({ success: false, error: result.error });
      }
      if (result.code === 400) {
        return res.status(400).json({ success: false, error: result.error });
      }
      res.json(result);
    });

    // 修改一条记录 PUT /api/leaderboard/:game/record
    // body: { timestamp, nickname?, score?, extra? }
    app.put('/api/leaderboard/:game/record', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const gameId = req.params.game;
      const { timestamp, nickname, score, extra } = req.body;
      const result = service.updateRecord(gameId, timestamp, { nickname, score, extra }, siteConfig);
      if (result.code === 404) {
        return res.status(404).json({ success: false, error: result.error });
      }
      if (result.code === 400) {
        return res.status(400).json({ success: false, error: result.error });
      }
      res.json(result);
    });
  }
  
  const api = {
    service,
    
    getLeaderboard(gameId, options) {
      return service.getLeaderboard(gameId, options, siteConfig);
    },
    
    submitScore(gameId, data, userPoints, completedChallenges) {
      return service.submitScore(gameId, data, siteConfig, userPoints, completedChallenges);
    },
    
    getGamesList() {
      return service.getGamesList(siteConfig);
    },
    
    getOverview() {
      const result = {};
      const configs = service.getGameConfigs(siteConfig);
      for (const gameId of Object.keys(configs)) {
        result[gameId] = service.getLeaderboardOverview(gameId, siteConfig);
      }
      return result;
    }
  };
  
  context.eventBus.on('user:points-request', (data) => {
    context.logger.debug('Received user:points-request event');
  });
  
  context.logger.info('Leaderboard plugin initialized with API routes');
  
  return api;
};