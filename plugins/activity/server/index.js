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

    app.post('/api/activity/:id/prediction', (req, res) => {
      const activityId = req.params.id;
      const { nickname, champion, score, mvp, predictions } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = service.submitPrediction(activityId, nickname, { champion, score, mvp, predictions });
      res.json(result);
    });

    app.post('/api/activity/:id/predictions', (req, res) => {
      const activityId = req.params.id;
      const { nickname, champion, score, mvp, predictions } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = service.submitPrediction(activityId, nickname, { champion, score, mvp, predictions });
      res.json(result);
    });

    app.get('/api/activity/:id/prediction/:nickname', (req, res) => {
      const { id, nickname } = req.params;
      const prediction = service.getPrediction(id, nickname);
      res.json({ success: true, prediction: prediction || null });
    });

    app.post('/api/lottery/draw', (req, res) => {
      const { nickname, activityId } = req.body;
      if (!nickname) return res.status(400).json({ success: false, error: '昵称不能为空' });
      const result = service.lotteryDraw(nickname, activityId);
      if (result.error) return res.status(400).json(result);
      res.json(result);
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
    }
  };
  
  context.logger.info('Activity plugin initialized with API routes');
  
  return api;
};