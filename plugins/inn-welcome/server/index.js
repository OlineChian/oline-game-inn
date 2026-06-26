'use strict';

/**
 * 客栈迎新活动插件入口
 * =====================
 * 注册路由：
 *   - GET    /activities/inn-welcome/adminoline  隐藏管理员入口（无入口按钮，仅URL可达）
 *   - POST   /api/inn-welcome/submit             玩家提交成绩
 *   - GET    /api/inn-welcome/submissions        管理员查看全部提交
 *   - DELETE /api/inn-welcome/submission         管理员删除一条提交（按昵称，可选 ADMIN_TOKEN）
 *   - GET    /api/inn-welcome/weights            读取游戏权重
 *   - POST /api/inn-welcome/weights            设置权重并重算权重分
 *   - POST /api/inn-welcome/lottery            按权重分加权抽奖
 *   - GET  /api/inn-welcome/lottery/result     读取抽奖结果
 *
 * 注意：管理员页面无鉴权（与现有活动管理端点一致），靠 URL 隐藏。
 */

const path = require('path');
const fs = require('fs');
const InnWelcomeService = require('./service');
const { checkAdminAuth } = require('../../../core/server/admin-routes');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const ADMIN_PAGE = path.join(ROOT_DIR, 'activities', 'inn-welcome', 'adminoline.html');

module.exports = function(app, context) {
  const service = new InnWelcomeService(context);

  // ===== 隐藏管理员入口：活动URL + /adminoline =====
  app.get('/activities/inn-welcome/adminoline', (req, res) => {
    if (fs.existsSync(ADMIN_PAGE)) {
      res.sendFile(ADMIN_PAGE);
    } else {
      res.status(404).send('Admin page not found');
    }
  });

  // ===== 玩家提交成绩 =====
  app.post('/api/inn-welcome/submit', (req, res) => {
    const r = service.submit(req.body);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  // ===== 管理员：查看全部提交 =====
  app.get('/api/inn-welcome/submissions', (req, res) => {
    res.json({ success: true, submissions: service.listSubmissions() });
  });

  // ===== 管理员：删除一条提交记录（清理篡改数据用）=====
  // 鉴权：可选 ADMIN_TOKEN（未设则仅靠 URL 隐藏，与排行榜管理端点一致）
  app.delete('/api/inn-welcome/submission', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) {
      return res.status(401).json({ success: false, error: auth.error });
    }
    const nickname = req.query.nickname;
    const r = service.deleteSubmission(nickname);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  // ===== 管理员：读取权重 =====
  app.get('/api/inn-welcome/weights', (req, res) => {
    res.json({ success: true, weights: service.getWeights(), games: service.getGames() });
  });

  // ===== 管理员：设置权重并重算权重分 =====
  app.post('/api/inn-welcome/weights', (req, res) => {
    const r = service.computeWeights(req.body);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  // ===== 管理员：加权抽奖 =====
  app.post('/api/inn-welcome/lottery', (req, res) => {
    const r = service.runLottery(req.body && req.body.count);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  // ===== 管理员：读取抽奖结果 =====
  app.get('/api/inn-welcome/lottery/result', (req, res) => {
    res.json({ success: true, result: service.getLotteryResult() });
  });

  context.logger.info('[inn-welcome] plugin initialized with API routes');

  return {
    service,
    submit: (d) => service.submit(d),
    listSubmissions: () => service.listSubmissions(),
    deleteSubmission: (n) => service.deleteSubmission(n),
    computeWeights: (w) => service.computeWeights(w),
    runLottery: (c) => service.runLottery(c)
  };
};
