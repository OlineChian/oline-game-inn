'use strict';

/**
 * 巅峰双重挑战 - 插件入口
 * 路由：
 *   GET  /activities/peak-dual/adminoline       隐藏管理员页面
 *   POST /api/peak-dual/bind                    绑定 Player Tag + 游戏昵称
 *   GET  /api/peak-dual/player/:tag             获取玩家状态
 *   POST /api/peak-dual/query                   查询成绩（刷新权重）
 *   POST /api/peak-dual/draw                    抽奖
 *   GET  /api/peak-dual/status                  活动状态
 *   GET  /api/peak-dual/admin/players           全部玩家（admin）
 *   GET  /api/peak-dual/admin/config            运行时配置（admin）
 *   POST /api/peak-dual/admin/config            更新配置（admin）
 *   GET  /api/peak-dual/admin/logs              全部日志（admin）
 *   GET  /api/peak-dual/admin/winners           中奖名单（admin）
 */

const path = require('path');
const fs = require('fs');
const PeakDualService = require('./service');
const { checkAdminAuth } = require('../../../core/server/admin-routes');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const ADMIN_PAGE = path.join(ROOT_DIR, 'activities', 'peak-dual', 'adminoline.html');

module.exports = function(app, context) {
  const service = new PeakDualService(context);

  app.get('/activities/peak-dual/adminoline', (req, res) => {
    if (fs.existsSync(ADMIN_PAGE)) res.sendFile(ADMIN_PAGE);
    else res.status(404).send('Admin page not found');
  });

  app.post('/api/peak-dual/bind', (req, res) => {
    const { playerTag, gameNickname } = req.body || {};
    const r = service.bind(playerTag, gameNickname);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  app.get('/api/peak-dual/player/:tag', (req, res) => {
    const r = service.getPlayer(decodeURIComponent(req.params.tag));
    if (r.error) return res.status(r.code || 404).json({ success: false, error: r.error });
    res.json(r);
  });

  app.post('/api/peak-dual/query', (req, res) => {
    const { playerTag } = req.body || {};
    const r = service.query(playerTag, req);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  app.post('/api/peak-dual/draw', (req, res) => {
    const { playerTag } = req.body || {};
    const r = service.draw(playerTag, req);
    if (r.error) return res.status(r.code || 400).json({ success: false, error: r.error });
    res.json(r);
  });

  app.get('/api/peak-dual/status', (req, res) => {
    res.json(service.getStatus());
  });

  // ===== 管理员路由 =====
  app.get('/api/peak-dual/admin/players', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json(service.listPlayers());
  });

  app.get('/api/peak-dual/admin/config', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json({ success: true, config: service.getRuntimeConfig() });
  });

  app.post('/api/peak-dual/admin/config', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json(service.setRuntimeConfig(req.body || {}));
  });

  app.get('/api/peak-dual/admin/logs', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json(service.getLogs());
  });

  app.get('/api/peak-dual/admin/winners', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json(service.getWinners());
  });

  app.post('/api/peak-dual/admin/initialize', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json(service.initialize());
  });

  context.logger.info('[peak-dual] plugin initialized with API routes');
  return { service };
};
