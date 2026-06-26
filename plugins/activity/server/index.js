/**
 * 活动系统插件入口
 * 提供：活动发现、积分管理、预测、抽奖
 */

const ActivityService = require('./service');
const path = require('path');

module.exports = function(app, context) {
  const service = new ActivityService(context);
  
  const basePath = path.join(__dirname, '..', '..', '..');

  if (app) {
    app.get('/api/activities', (req, res) => {
      const config = service.loadActivitiesConfig(basePath);
      const now = new Date();
      const activeActivities = config.activities.filter(activity => {
        if (!activity.enabled) return false;
        const endTime = new Date(activity.endTime);
        return endTime > now;
      });
      res.json({
        success: true,
        activities: activeActivities,
        pointsConfig: config.pointsConfig
      });
    });

    app.get('/api/activity/:id', (req, res) => {
      const activityId = req.params.id;
      const config = service.loadActivitiesConfig(basePath);
      const activity = config.activities.find(a => a.id === activityId);
      if (!activity || !activity.enabled) {
        return res.status(404).json({ success: false, error: '活动不存在或已下架' });
      }
      res.json({
        success: true,
        activity: activity,
        pointsConfig: config.pointsConfig
      });
    });

    app.get('/api/challenges', (req, res) => {
      const config = service.loadActivitiesConfig(basePath);
      res.json({
        success: true,
        challenges: config.activities.reduce((acc, a) => {
          if (a.challenge) acc[a.id] = a.challenge;
          return acc;
        }, {})
      });
    });

    app.post('/api/activity/:id/prediction', async (req, res) => {
      const activityId = req.params.id;
      const { nickname, champion, score, mvp, predictions } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = await service.submitPrediction(activityId, nickname, { champion, score, mvp, predictions });
      if (result.error) return res.status(result.code || 400).json(result);
      res.json(result);
    });

    app.post('/api/activity/:id/predictions', async (req, res) => {
      const activityId = req.params.id;
      const { nickname, champion, score, mvp, predictions } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = await service.submitPrediction(activityId, nickname, { champion, score, mvp, predictions });
      if (result.error) return res.status(result.code || 400).json(result);
      res.json(result);
    });

    app.get('/api/activity/:id/prediction/:nickname', (req, res) => {
      const { id, nickname } = req.params;
      const prediction = service.getPrediction(id, nickname);
      res.json({ success: true, prediction: prediction || null });
    });

    // 结算单个用户的预测积分
    app.post('/api/activity/:id/prediction/:nickname/settle', async (req, res) => {
      const { id, nickname } = req.params;
      const { matchResults } = req.body;
      if (!matchResults) return res.status(400).json({ success: false, error: '缺少 matchResults' });
      const result = await service.settlePrediction(id, nickname, { matchResults });
      if (result.error) return res.status(404).json(result);
      res.json(result);
    });

    // 批量结算所有用户预测（管理员用）
    app.post('/api/activity/:id/predictions/settle-all', async (req, res) => {
      const { id } = req.params;
      const { matchResults } = req.body;
      if (!matchResults) return res.status(400).json({ success: false, error: '缺少 matchResults' });
      const result = await service.settleAllPredictions(id, { matchResults });
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    app.post('/api/lottery/draw', (req, res) => {
      const { nickname, activityId } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = service.lotteryDraw(nickname, activityId);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // ===== 挑战 Session API =====
    // 创建挑战 Session（活动页点击"开始挑战"时调用）
    app.post('/api/challenge/session', (req, res) => {
      const { nickname, activityId, gameId } = req.body;
      if (!nickname || !activityId || !gameId) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }
      const session = service.createChallengeSession(nickname, activityId, gameId);
      res.json({ success: true, session });
    });

    // 提交单局成绩（游戏每局结束后调用）
    app.post('/api/challenge/session/:sessionId/score', async (req, res) => {
      const { sessionId } = req.params;
      const { score } = req.body;
      if (score === undefined) {
        return res.status(400).json({ success: false, error: '分数不能为空' });
      }
      const result = await service.submitChallengeScore(sessionId, score);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // 获取 Session 状态（活动页轮询）
    app.get('/api/challenge/session/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      const session = service.getChallengeSession(sessionId);
      if (!session) return res.status(404).json({ success: false, error: 'Session不存在' });
      res.json({ success: true, session });
    });

    // 获取用户各游戏的挑战最佳成绩
    app.get('/api/challenge/user/:nickname/best', (req, res) => {
      const { nickname } = req.params;
      const activityId = req.query.activityId;
      const result = service.getUserChallengeBest(decodeURIComponent(nickname), activityId);
      res.json({ success: true, best: result });
    });
  }
  
  const api = {
    service,
    
    getActivities() {
      return service.getActiveActivities(basePath);
    },
    
    getActivity(activityId) {
      return service.getActivity(activityId, basePath);
    },
    
    submitPrediction(activityId, nickname, data) {
      return service.submitPrediction(activityId, nickname, data);
    },
    
    getPrediction(activityId, nickname) {
      return service.getPrediction(activityId, nickname);
    },
    
    lotteryDraw(nickname, activityId) {
      return service.lotteryDraw(nickname, activityId);
    },

    createChallengeSession(nickname, activityId, gameId) {
      return service.createChallengeSession(nickname, activityId, gameId);
    },

    getChallengeSession(sessionId) {
      return service.getChallengeSession(sessionId);
    },

    submitChallengeScore(sessionId, score) {
      return service.submitChallengeScore(sessionId, score);
    },

    settlePrediction(activityId, nickname, results) {
      return service.settlePrediction(activityId, nickname, results);
    },

    settleAllPredictions(activityId, results) {
      return service.settleAllPredictions(activityId, results);
    }
  };
  
  context.logger.info('Activity plugin initialized with API routes');
  
  return api;
};