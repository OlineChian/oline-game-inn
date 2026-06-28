/**
 * 排行榜插件入口
 * 注册 API 路由，提供排行榜服务
 */

const LeaderboardService = require('./service');
const { verifySubmission, verifyAntiCheat, checkBan, listBans, unban } = require('./security');
const {
  applyPenalty, getRules, setRules, listHistory, resetViolation, RULE_CATEGORIES
} = require('./penalty');
const { getThresholds, getAllThresholdDefs, setThresholds, GAME_NAMES } = require('./game-thresholds');
const { recordFailure, listFailed, getFailed, markUploaded, deleteFailed } = require('./failed-submissions');
const { checkAdminAuth } = require('../../../core/server/admin-routes');
const fs = require('fs');
const path = require('path');

// 获取客户端 IP（兼容反向代理）
function getClientIp(req) {
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || '';
}

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
      const ip = getClientIp(req);
      // 原始签名数据，失败时一并存档（审计 + 管理员人工重新上传）
      const payload = {
        timestamp: req.body && req.body.timestamp,
        nonce: req.body && req.body.nonce,
        signature: req.body && req.body.signature
      };

      // L4: 封禁检查（作弊者封禁期内禁止提交）
      const ban = checkBan(service.storage, ip);
      if (ban.banned) {
        recordFailure(service.storage, {
          gameId, nickname, score, extra, ip,
          error: 'IP 已被封禁：' + (ban.reason || '作弊行为'),
          status: 403, category: 'security', payload
        });
        // 返回 ban 详情供客户端弹窗展示（提示玩家联系管理员，而非误以为是 bug）
        return res.status(403).json({
          success: false,
          error: '该 IP 已被封禁：' + (ban.reason || '作弊行为'),
          banned: true,
          banReason: ban.reason || '作弊行为',
          banUntil: ban.until,
          banAt: ban.at,
          nickname: ban.nickname
        });
      }

      // L1+L2: HMAC 签名 + 时间窗口 + nonce 防重放
      const verification = verifySubmission(gameId, req.body);
      if (!verification.ok) {
        recordFailure(service.storage, {
          gameId, nickname, score, extra, ip,
          error: verification.error,
          status: verification.code, category: 'signature', payload
        });
        return res.status(verification.code).json({ success: false, error: verification.error });
      }

      // L3: 反作弊校验（防 AFK / 状态篡改），传入安全规则开关 + 分游戏阈值
      const rules = getRules(service.storage);
      const thresholds = getThresholds(service.storage, gameId);
      const acCheck = verifyAntiCheat(gameId, req.body, rules, thresholds);
      if (!acCheck.ok) {
        // 分级惩罚：第1次警告（成绩不上传）→ 10min → 30min → 2h → 8h → 24h 封顶
        const penalty = applyPenalty(service.storage, ip, acCheck.error, nickname, gameId);
        // 失败提交统一记录（含 antiCheat 数据），管理员可在管理后台重新上传
        recordFailure(service.storage, {
          gameId, nickname, score, extra, ip,
          error: acCheck.error,
          status: penalty.action === 'warn' ? 200 : 403,
          category: 'security', payload
        });
        if (penalty.action === 'warn') {
          // 警告：本次成绩不上传，不封禁 IP，玩家可继续游戏
          return res.status(200).json({
            success: false,
            warned: true,
            error: acCheck.error,
            reason: acCheck.error,
            violationCount: penalty.count,
            penaltyLevel: penalty.level
          });
        }
        // 封禁：返回 403 触发客户端封禁弹窗
        return res.status(403).json({
          success: false,
          error: '该 IP 已被封禁：' + acCheck.error,
          banned: true,
          banReason: acCheck.error,
          banUntil: Date.now() + penalty.durationMs,
          banAt: Date.now(),
          nickname: nickname
        });
      }

      // 排行榜只存储成绩与排名；挑战积分由活动中心 Session 流程独立结算
      const result = service.submitScore(gameId, { nickname, score, extra, ip }, siteConfig);

      if (result.code === 404) {
        recordFailure(service.storage, {
          gameId, nickname, score, extra, ip,
          error: result.error, status: 404, category: 'service', payload
        });
        return res.status(404).json({ success: false, error: result.error });
      }
      if (result.code === 400) {
        recordFailure(service.storage, {
          gameId, nickname, score, extra, ip,
          error: result.error, status: 400, category: 'service', payload
        });
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

    // ===== 作弊与安全管理 API（管理后台 /securityoline 使用）=====
    // 鉴权：可选 ADMIN_TOKEN（未设则仅靠 URL 隐藏，与 /adminoline 一致）

    // 列出所有封禁记录
    // GET /api/security/bans
    app.get('/api/security/bans', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const bans = listBans(service.storage);
      res.json({ success: true, bans, total: bans.length });
    });

    // 解除封禁
    // DELETE /api/security/bans/:ip?resetViolation=true
    //   resetViolation=true 同时重置违规计数，使该 IP 从警告等级重新开始（避免误封累积）
    app.delete('/api/security/bans/:ip', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const ip = decodeURIComponent(req.params.ip || '');
      if (!ip) {
        return res.status(400).json({ success: false, error: 'IP 不能为空' });
      }
      const existed = unban(service.storage, ip);
      if (!existed) {
        return res.status(404).json({ success: false, error: '未找到该 IP 的封禁记录' });
      }
      let violationReset = false;
      if (req.query.resetViolation === 'true') {
        violationReset = resetViolation(service.storage, ip);
      }
      res.json({ success: true, ip, violationReset });
    });

    // 读取安全规则开关
    // GET /api/security/rules
    app.get('/api/security/rules', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const rules = getRules(service.storage);
      res.json({
        success: true,
        rules,
        categories: RULE_CATEGORIES
      });
    });

    // 更新安全规则开关
    // PUT /api/security/rules  body: { timeConsistency: false, ... }
    app.put('/api/security/rules', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const rules = setRules(service.storage, req.body || {});
      res.json({ success: true, rules });
    });

    // 查询惩罚历史记录（永久保存全部，按时间倒序）
    // GET /api/security/history
    app.get('/api/security/history', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const history = listHistory(service.storage);
      res.json({ success: true, history, total: history.length });
    });

    // 分游戏反作弊阈值配置
    // GET /api/security/thresholds - 获取所有游戏阈值定义
    app.get('/api/security/thresholds', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      res.json({ success: true, thresholds: getAllThresholdDefs(service.storage), gameNames: GAME_NAMES });
    });

    // PUT /api/security/thresholds/:gameId - 更新某游戏阈值
    app.put('/api/security/thresholds/:gameId', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const result = setThresholds(service.storage, req.params.gameId, req.body || {});
      if (!result) return res.status(404).json({ success: false, error: '未知游戏: ' + req.params.gameId });
      res.json({ success: true, thresholds: result });
    });

    // ===== 失败提交记录（管理员重新上传）=====

    // 列出全部失败提交
    // GET /api/security/failed-submissions?category=signature&uploaded=false
    app.get('/api/security/failed-submissions', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const opts = {};
      if (req.query.category) opts.category = String(req.query.category);
      if (req.query.uploaded === 'true') opts.uploaded = true;
      if (req.query.uploaded === 'false') opts.uploaded = false;
      const list = listFailed(service.storage, opts);
      res.json({ success: true, failed: list, total: list.length });
    });

    // 管理员重新上传某条失败提交的成绩
    // POST /api/security/failed-submissions/:id/retry
    // 强制上传：绕过签名、反作弊、scoreCap 等所有校验，直接写入排行榜
    app.post('/api/security/failed-submissions/:id/retry', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const rec = getFailed(service.storage, req.params.id);
      if (!rec) {
        return res.status(404).json({ success: false, error: '未找到该失败提交记录' });
      }
      // 调用 forceInsertScore，绕过所有校验（签名/反作弊/scoreCap/scoreFloor/游戏配置）
      const result = service.forceInsertScore(rec.gameId, {
        nickname: rec.nickname,
        score: rec.score,
        extra: rec.extra,
        ip: rec.ip
      }, siteConfig);
      markUploaded(service.storage, rec.id);
      res.json({ success: true, result: result, uploaded: true });
    });

    // 删除某条失败提交记录
    // DELETE /api/security/failed-submissions/:id
    app.delete('/api/security/failed-submissions/:id', (req, res) => {
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ success: false, error: auth.error });
      }
      const ok = deleteFailed(service.storage, req.params.id);
      if (!ok) return res.status(404).json({ success: false, error: '未找到该失败提交记录' });
      res.json({ success: true });
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