/**
 * 用户系统插件入口
 * 提供：积分管理（单积分体系，含流水）
 *
 * 路由：
 *   GET  /api/user/:nickname/points          获取积分
 *   GET  /api/user/:nickname/points/history  获取流水
 *   POST /api/user/:nickname/points/award    奖励积分（内部/admin）
 *   POST /api/user/:nickname/points/deduct   扣减积分（直通奖励卡）
 *
 * 事件总线：
 *   user:get-points    获取积分（callback）
 *   user:award-points  奖励积分（fire-and-forget，含防刷）
 *   user:deduct-points 扣减积分（callback 返回成功/失败）
 */

const UserService = require('./service');

module.exports = function(app, context) {
  const service = new UserService(context);

  if (app) {
    app.get('/api/user/:nickname/points', (req, res) => {
      const nickname = req.params.nickname;
      const points = service.getPoints(nickname);
      res.json({ success: true, nickname, points });
    });

    app.get('/api/user/:nickname/points/history', (req, res) => {
      const nickname = req.params.nickname;
      const limit = parseInt(req.query.limit, 10) || 50;
      const history = service.getHistory(nickname, limit);
      res.json({ success: true, nickname, history });
    });

    app.post('/api/user/:nickname/points/award', (req, res) => {
      const nickname = req.params.nickname;
      const { amount, reason, activityId } = req.body;
      if (!amount || !Number.isFinite(Number(amount))) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }
      const points = service.addPoints(nickname, Number(amount), reason, activityId);
      res.json({ success: true, points });
    });

    app.post('/api/user/:nickname/points/deduct', (req, res) => {
      const nickname = req.params.nickname;
      const { amount, reason, activityId } = req.body;
      if (!amount || !Number.isFinite(Number(amount))) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }
      const result = service.deductPoints(nickname, Number(amount), reason, activityId);
      if (result.error) return res.status(result.code || 400).json({ success: false, error: result.error });
      res.json({ success: true, points: result.points });
    });
  }

  // 事件总线：获取积分（callback 模式）
  context.eventBus.on('user:get-points', (data) => {
    const { nickname, callback } = data;
    const points = service.getPoints(nickname);
    if (callback) callback(points);
  });

  // 事件总线：奖励积分（fire-and-forget，含每人每活动一次防刷）
  context.eventBus.on('user:award-points', (data) => {
    const { nickname, amount, reason, activityId } = data;
    if (!nickname || !amount) return;
    if (activityId && service.hasBeenRewarded(nickname, activityId)) {
      context.logger.debug(`[user] ${nickname} 已对 ${activityId} 领取过奖励，跳过`);
      return;
    }
    service.addPoints(nickname, amount, reason, activityId);
    if (activityId) service.markRewarded(nickname, activityId);
    context.logger.info(`[user] ${nickname} 获得 ${amount} 积分（${reason || ''}）`);
  });

  // 事件总线：扣减积分（callback 返回成功/失败，供直通奖励卡判断）
  context.eventBus.on('user:deduct-points', (data) => {
    const { nickname, amount, reason, activityId, callback } = data;
    if (!nickname || !amount) {
      if (callback) callback({ error: '参数不完整' });
      return;
    }
    const result = service.deductPoints(nickname, amount, reason, activityId);
    if (callback) callback(result);
  });

  const api = {
    service,
    getPoints(nickname) { return service.getPoints(nickname); },
    addPoints(nickname, amount, reason, activityId) { return service.addPoints(nickname, amount, reason, activityId); },
    deductPoints(nickname, amount, reason, activityId) { return service.deductPoints(nickname, amount, reason, activityId); },
    getHistory(nickname, limit) { return service.getHistory(nickname, limit); }
  };

  context.logger.info('User plugin initialized with API routes');

  return api;
};
