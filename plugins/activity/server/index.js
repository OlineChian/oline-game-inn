/**
 * 活动系统插件入口
 * 提供：活动发现（含已结束展示）
 */

const ActivityService = require('./service');
const path = require('path');

module.exports = function(app, context) {
  const service = new ActivityService(context);
  const basePath = path.join(__dirname, '..', '..', '..');

  if (app) {
    // 获取活动列表（活跃 + 已结束）
    app.get('/api/activities', (req, res) => {
      const { active, ended } = service.getActiveActivities(basePath);
      const config = service.loadActivitiesConfig(basePath);
      res.json({
        success: true,
        activities: active,
        endedActivities: ended,
        pointsConfig: config.pointsConfig
      });
    });

    // 获取单个活动详情
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
  }

  const api = {
    service,
    getActivities() {
      return service.getActiveActivities(basePath);
    },
    getActivity(activityId) {
      return service.getActivity(activityId, basePath);
    }
  };

  context.logger.info('Activity plugin initialized with API routes');

  return api;
};
