/**
 * 用户系统插件入口
 * 提供：积分管理、挑战记录
 */

const UserService = require('./service');

module.exports = function(app, context) {
  const service = new UserService(context);

  if (app) {
    app.get('/api/user/:nickname/points', (req, res) => {
      const nickname = req.params.nickname;
      const points = service.getPoints(nickname);
      res.json({
        success: true,
        nickname: nickname,
        points: points
      });
    });

    app.post('/api/user/:nickname/points', (req, res) => {
      const nickname = req.params.nickname;
      const { type, amount, reason } = req.body;
      
      if (!type || !amount) {
        return res.status(400).json({ success: false, error: '参数不完整' });
      }
      
      const points = service.updatePoints(nickname, type, amount, reason);
      res.json({
        success: true,
        points: points
      });
    });

    app.post('/api/user/points', (req, res) => {
      const { nickname, challengePoints, predictionPoints, totalPoints } = req.body;
      
      if (!nickname) {
        return res.status(400).json({ success: false, error: '昵称不能为空' });
      }
      
      const points = service.syncPoints(nickname, challengePoints, predictionPoints);
      res.json({
        success: true,
        points: points
      });
    });

    // 接收 activity plugin 同步积分（设置绝对值）
    app.post('/api/user/:nickname/sync', (req, res) => {
      const { nickname } = req.params;
      const { challenge, prediction, total } = req.body;
      
      if (!nickname) {
        return res.status(400).json({ success: false, error: '昵称不能为空' });
      }
      
      const points = service.syncPoints(nickname, challenge, prediction);
      res.json({ success: true, points });
    });

    context.eventBus.on('challenge:completed', (data) => {
      const { nickname, challenge, gameId } = data;
      if (challenge && challenge.reward) {
        // 防重复结算：同一用户同一游戏只发放一次挑战奖励
        if (service.hasCompletedChallenge(nickname, gameId)) {
          context.logger.debug(`${nickname} 已完成 ${gameId} 挑战，跳过重复结算`);
          return;
        }
        service.updatePoints(nickname, 'challenge', challenge.reward, `完成挑战：${challenge.name}`);
        service.markChallengeCompleted(nickname, gameId);
        context.logger.info(`${nickname} 完成挑战，获得 ${challenge.reward} 积分`);
      }
    });
  }
  
  const api = {
    service,
    
    getPoints(nickname) {
      return service.getPoints(nickname);
    },
    
    updatePoints(nickname, type, amount, reason) {
      return service.updatePoints(nickname, type, amount, reason);
    },
    
    syncPoints(nickname, challengePoints, predictionPoints) {
      return service.syncPoints(nickname, challengePoints, predictionPoints);
    },
    
    deductPoints(nickname, amount, reason) {
      return service.deductPoints(nickname, amount, reason);
    },
    
    refundPoints(nickname, amount, reason) {
      return service.refundPoints(nickname, amount, reason);
    },
    
    hasCompletedChallenge(nickname, gameId) {
      return service.hasCompletedChallenge(nickname, gameId);
    },
    
    markChallengeCompleted(nickname, gameId) {
      return service.markChallengeCompleted(nickname, gameId);
    }
  };
  
  context.eventBus.on('user:get-points', (data) => {
    const { nickname, callback } = data;
    const points = service.getPoints(nickname);
    if (callback) callback(points);
  });
  
  context.eventBus.on('user:update-points', (data) => {
    const { nickname, type, amount, reason } = data;
    service.updatePoints(nickname, type, amount, reason);
  });
  
  context.eventBus.on('user:check-challenge', (data) => {
    const { nickname, gameId, callback } = data;
    const completed = service.hasCompletedChallenge(nickname, gameId);
    if (callback) callback(completed);
  });
  
  context.logger.info('User plugin initialized with API routes');
  
  return api;
};