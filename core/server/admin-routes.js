/**
 * 管理员运维接口
 *
 * 注册隐藏 URL，供管理员在运行时操作底层存储，无需重启服务。
 * 与现有活动管理端点一致，采用"无鉴权 + 靠 URL 隐藏"模式；
 * 可选通过 ADMIN_TOKEN 环境变量加一层 token 校验（设置后必传，未设置则仅靠 URL 隐藏）。
 *
 * 已注册路由：
 *   POST /admin/storage/reload  重新从持久化源全量加载内存镜像
 */

const path = require('path');
const { getGlobalStore } = require('../storage');

/**
 * 校验管理员请求
 * - 未设置 ADMIN_TOKEN：放行（仅靠 URL 隐藏）
 * - 设置了 ADMIN_TOKEN：要求请求头 x-admin-token 或 query ?token= 匹配
 */
function checkAdminAuth(req) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return { ok: true };
  const provided = req.headers['x-admin-token'] || req.query.token;
  if (provided !== adminToken) {
    return { ok: false, error: '未授权（ADMIN_TOKEN 校验失败）' };
  }
  return { ok: true };
}

/**
 * 在 app 上注册管理员路由
 * @param {import('express').Express} app
 */
function registerAdminRoutes(app) {
  if (!app) return;

  // 管理后台页面（浏览器地址栏直接访问）
  // GET /adminoline 返回排行榜管理页面（页面内通过 API 增删改记录）
  app.get('/adminoline', (req, res) => {
    // 页面访问本身不强制鉴权（靠 URL 隐藏）；
    // 实际数据操作（DELETE/PUT）由对应 API 路由的 checkAdminAuth 校验
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'adminoline.html'));
  });

  console.log('[Admin] Route registered: GET /adminoline');

  // 作弊与安全管理页面（浏览器地址栏直接访问）
  // GET /securityoline 返回封禁记录管理页面（页面内通过 API 查询/解封）
  app.get('/securityoline', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'securityoline.html'));
  });

  console.log('[Admin] Route registered: GET /securityoline');

  // 重新从持久化源全量加载存储内存镜像
  // 适用场景：外部直接修改 kv_store 表 / store.json 后，让运行中进程同步更新
  app.post('/admin/storage/reload', async (req, res) => {
    const auth = checkAdminAuth(req);
    if (!auth.ok) {
      return res.status(401).json({ success: false, error: auth.error });
    }

    const store = getGlobalStore();
    if (!store || typeof store.reload !== 'function') {
      return res.status(500).json({
        success: false,
        error: '当前存储驱动不支持 reload'
      });
    }

    try {
      const result = await store.reload();
      console.log(`[Admin] storage reload 完成: driver=${result.driver}, keys=${result.keys}`);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('[Admin] storage reload 失败:', err.message);
      res.status(500).json({ success: false, error: 'reload 失败: ' + err.message });
    }
  });

  console.log('[Admin] Route registered: POST /admin/storage/reload');
}

module.exports = { registerAdminRoutes, checkAdminAuth };
