'use strict';

/**
 * 公告系统插件入口
 * =====================
 * 存储（通过 context.storage 分区存储）：
 *   notice:list    → [{ id, title, content, signature, type, active, createdAt, updatedAt }]
 *   notice:welcome → { title, content, signature, active, updatedAt }  迎新公告（首次访问展示）
 *
 * 公告类型（决定客户端弹窗配色）：
 *   info   普通公告（主题色）
 *   event  活动公告（金色）
 *   update 更新公告（绿色）
 *   urgent 紧急公告（红色）
 *
 * 路由：
 *   GET    /api/notice/active      客户端：获取活跃公告 + 迎新公告
 *   GET    /api/notice/list        管理员：获取全部公告
 *   POST   /api/notice             管理员：创建公告
 *   PUT    /api/notice/:id         管理员：修改公告
 *   DELETE /api/notice/:id         管理员：删除公告
 *   GET    /api/notice/welcome     管理员：获取迎新公告
 *   PUT    /api/notice/welcome     管理员：修改迎新公告
 *   GET    /api/notice/templates   管理员：获取参考模板
 */

const { checkAdminAuth } = require('../../../core/server/admin-routes');

const NOTICE_TYPES = ['info', 'event', 'update', 'urgent'];

// 预置参考模板（管理员填写时可一键载入）
const TEMPLATES = [
  {
    name: '普通公告',
    type: 'info',
    title: '游戏更新小贴士',
    content: '亲爱的玩家们：\n\n我们刚刚优化了部分游戏体验，欢迎大家试玩反馈！\n\n如有问题或建议，请通过"提交反馈"联系我们。',
    signature: 'Oline 客栈管理组'
  },
  {
    name: '活动公告',
    type: 'event',
    title: '周末活动开启',
    content: '本周末将开启限时活动，参与游戏即可获得额外积分奖励！\n\n活动时间：周六 00:00 - 周日 23:59\n\n快来挑战吧！',
    signature: 'Oline 客栈活动组'
  },
  {
    name: '更新公告',
    type: 'update',
    title: '版本更新通知',
    content: '我们已发布新版本：\n\n- 新增游戏关卡\n- 优化排行榜加载速度\n- 修复已知问题\n\n刷新页面即可体验最新版本。',
    signature: 'Oline 客栈开发组'
  },
  {
    name: '紧急公告',
    type: 'urgent',
    title: '服务器临时维护通知',
    content: '由于服务器临时维护，部分功能可能短暂不可用。\n\n预计维护时间：30 分钟内完成。\n\n给您带来的不便敬请谅解，感谢您的耐心等待。',
    signature: 'Oline 客栈运维组'
  },
  {
    name: '迎新公告',
    type: 'info',
    title: '欢迎来到 Oline 荒野游戏客栈',
    content: '欢迎来到 Oline 荒野游戏客栈！\n\n这里有多个精心制作的小游戏，支持排行榜竞技和联机对战。\n\n建议先到"活动中心"领取昵称，然后开始游戏挑战吧！\n\n祝您玩得开心！',
    signature: 'Oline 客栈管理组'
  }
];

// 默认迎新公告（首次部署即用）
const DEFAULT_WELCOME = {
  title: '欢迎来到 Oline 荒野游戏客栈',
  content: '欢迎来到 Oline 荒野游戏客栈！\n\n这里有多个精心制作的小游戏，支持排行榜竞技和联机对战。\n\n建议先到"活动中心"领取昵称，然后开始游戏挑战吧！\n\n祝您玩得开心！',
  signature: 'Oline 客栈管理组',
  active: true,
  updatedAt: 0
};

function genId() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getNoticeList(storage) {
  const list = storage.get('list');
  return Array.isArray(list) ? list : [];
}

function saveNoticeList(storage, list) {
  storage.set('list', list);
}

function getWelcome(storage) {
  const w = storage.get('welcome');
  if (w && typeof w === 'object') return Object.assign({}, DEFAULT_WELCOME, w);
  return Object.assign({}, DEFAULT_WELCOME);
}

function saveWelcome(storage, w) {
  w.updatedAt = Date.now();
  storage.set('welcome', w);
}

function validateNotice(body) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const signature = String(body.signature || '').trim();
  const type = String(body.type || 'info');
  if (!title) return { error: '标题不能为空' };
  if (!content) return { error: '内容不能为空' };
  if (NOTICE_TYPES.indexOf(type) < 0) return { error: '类型非法' };
  return { title, content, signature, type };
}

module.exports = function (app, context) {
  const storage = context.storage;

  // 客户端：获取活跃公告 + 迎新公告
  app.get('/api/notice/active', (req, res) => {
    const list = getNoticeList(storage)
      .filter(n => n.active)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const welcome = getWelcome(storage);
    res.json({
      success: true,
      welcome: welcome.active ? welcome : null,
      notices: list
    });
  });

  // 管理员：获取全部公告
  app.get('/api/notice/list', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    const list = getNoticeList(storage).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({ success: true, notices: list, total: list.length });
  });

  // 管理员：创建公告
  app.post('/api/notice', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    const v = validateNotice(req.body || {});
    if (v.error) return res.status(400).json({ success: false, error: v.error });
    const now = Date.now();
    const item = {
      id: genId(),
      title: v.title,
      content: v.content,
      signature: v.signature,
      type: v.type,
      active: req.body.active !== false,
      createdAt: now,
      updatedAt: now
    };
    const list = getNoticeList(storage);
    list.push(item);
    saveNoticeList(storage, list);
    res.json({ success: true, notice: item });
  });

  // 管理员：获取迎新公告（必须在 /:id 路由之前注册，避免 "welcome" 被 :id 参数捕获）
  app.get('/api/notice/welcome', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    res.json({ success: true, welcome: getWelcome(storage) });
  });

  // 管理员：修改迎新公告
  app.put('/api/notice/welcome', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    const v = validateNotice(req.body || {});
    if (v.error) return res.status(400).json({ success: false, error: v.error });
    const welcome = {
      title: v.title, content: v.content, signature: v.signature,
      active: req.body.active !== false, updatedAt: Date.now()
    };
    saveWelcome(storage, welcome);
    res.json({ success: true, welcome });
  });

  // 管理员：修改公告
  app.put('/api/notice/:id', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    const id = req.params.id;
    const list = getNoticeList(storage);
    const idx = list.findIndex(n => n.id === id);
    if (idx < 0) return res.status(404).json({ success: false, error: '公告不存在' });
    const v = validateNotice(req.body || {});
    if (v.error) return res.status(400).json({ success: false, error: v.error });
    Object.assign(list[idx], {
      title: v.title, content: v.content, signature: v.signature, type: v.type,
      active: req.body.active !== false, updatedAt: Date.now()
    });
    saveNoticeList(storage, list);
    res.json({ success: true, notice: list[idx] });
  });

  // 管理员：删除公告
  app.delete('/api/notice/:id', (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) return res.status(401).json({ success: false, error: auth.error });
    const id = req.params.id;
    const list = getNoticeList(storage);
    const idx = list.findIndex(n => n.id === id);
    if (idx < 0) return res.status(404).json({ success: false, error: '公告不存在' });
    const removed = list.splice(idx, 1)[0];
    saveNoticeList(storage, list);
    res.json({ success: true, notice: removed });
  });

  // 管理员：获取参考模板
  app.get('/api/notice/templates', (req, res) => {
    res.json({ success: true, templates: TEMPLATES });
  });

  context.logger.info('Notice plugin initialized with API routes');
  return {};
};
