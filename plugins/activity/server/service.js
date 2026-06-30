/**
 * 活动系统业务逻辑服务
 * 职责：活动发现、活动归档（已结束活动保留展示，超 3 个归档最旧）
 */

const fs = require('fs');
const path = require('path');

const MAX_ENDED_DISPLAY = 3;

class ActivityService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = context.config;
    this.activitiesDir = this.config.activitiesDir || 'activities';
  }

  /**
   * 加载活动配置（自动扫描 activities/ 目录）
   * 归档活动（archived:true）不返回给前端，但文件与数据保留
   */
  loadActivitiesConfig(basePath) {
    try {
      const dir = path.join(basePath, this.activitiesDir);
      const globalPath = path.join(dir, 'config.json');

      let globalConfig = { pointsConfig: {} };
      if (fs.existsSync(globalPath)) {
        globalConfig = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
      }

      const activities = [];
      const folders = fs.readdirSync(dir, { withFileTypes: true });

      for (const folder of folders) {
        if (!folder.isDirectory()) continue;
        const configPath = path.join(dir, folder.name, 'config.json');
        if (!fs.existsSync(configPath)) continue;

        try {
          const activityConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (activityConfig.archived === true) continue;
          activityConfig.path = `${folder.name}/index.html`;
          if (!activityConfig.id) activityConfig.id = folder.name;
          activities.push(activityConfig);
        } catch (err) {
          this.logger.error(`加载活动失败 ${folder.name}: ${err.message}`);
        }
      }

      return { activities, pointsConfig: globalConfig.pointsConfig || {} };
    } catch (err) {
      this.logger.error('加载活动配置失败:', err.message);
      return { activities: [], pointsConfig: {} };
    }
  }

  /**
   * 获取活动列表（活跃 + 已结束）
   * 已结束活动最多展示 MAX_ENDED_DISPLAY 个，超过则自动归档最旧的
   * @returns {{ active: Array, ended: Array }}
   */
  getActiveActivities(basePath) {
    const config = this.loadActivitiesConfig(basePath);
    const now = new Date();

    const active = [];
    const ended = [];

    for (const activity of config.activities) {
      if (!activity.enabled) continue;
      const endTime = new Date(activity.endTime);
      if (endTime > now) {
        active.push(activity);
      } else {
        ended.push(activity);
      }
    }

    // 已结束按 endTime 倒序（最新结束的在前）
    ended.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

    // 超过上限则归档最旧的（数组末尾）
    if (ended.length > MAX_ENDED_DISPLAY) {
      const toArchive = ended.slice(MAX_ENDED_DISPLAY);
      this._archiveActivities(basePath, toArchive);
      const archivedIds = new Set(toArchive.map(a => a.id));
      return {
        active,
        ended: ended.filter(a => !archivedIds.has(a.id))
      };
    }

    return { active, ended };
  }

  /**
   * 将活动标记为归档（写回各自 config.json 的 archived:true）
   * 不删除文件与数据，仅标记
   */
  _archiveActivities(basePath, activities) {
    for (const activity of activities) {
      const configPath = path.join(basePath, this.activitiesDir, activity.id, 'config.json');
      try {
        if (!fs.existsSync(configPath)) continue;
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        cfg.archived = true;
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        this.logger.info(`[activity] 活动已归档: ${activity.id}`);
      } catch (err) {
        this.logger.error(`[activity] 归档失败 ${activity.id}: ${err.message}`);
      }
    }
  }

  /**
   * 获取单个活动详情
   */
  getActivity(activityId, basePath) {
    const config = this.loadActivitiesConfig(basePath);
    return config.activities.find(a => a.id === activityId);
  }
}

module.exports = ActivityService;
