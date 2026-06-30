'use strict';

/**
 * 客栈迎新活动 - 业务逻辑服务
 * 职责：成绩提交、权重分计算、加权抽奖、积分配置、直通奖励卡
 * 数据键：submission:{nickname}、weights、lottery:result、direct-reward:{nickname}
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'activities', 'inn-welcome', 'config.json');
const GLOBAL_CONFIG_PATH = path.join(ROOT_DIR, 'activities', 'config.json');
const DEFAULT_TAG_PATTERN = '^#[A-Z0-9]{3,10}$';
const DEFAULT_POINTS_CONFIG = { participationReward: 10, directRewardCost: 50, directRewardPool: [] };

class InnWelcomeService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = this._loadConfig();
  }

  _loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      this.logger.error('[inn-welcome] 加载活动配置失败: ' + e.message);
      return { games: [], tag: { pattern: DEFAULT_TAG_PATTERN, hint: '' }, lottery: { defaultCount: 3 } };
    }
  }

  getGames() {
    return this.config.games || [];
  }

  getConfig() {
    return this.config;
  }

  _tagValid(tag) {
    const src = (this.config.tag && this.config.tag.pattern) || DEFAULT_TAG_PATTERN;
    return new RegExp(src).test(tag || '');
  }

  /**
   * 提交成绩（同一昵称覆盖更新）
   * @param {Object} data { nickname, tag, scores }
   */
  submit(data) {
    const { nickname, tag, scores } = data || {};
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      return { error: '昵称不能为空', code: 400 };
    }
    if (!this._tagValid(tag)) {
      return { error: '游戏标签格式不正确：' + (this.config.tag?.hint || ''), code: 400 };
    }
    if (!scores || typeof scores !== 'object') {
      return { error: '成绩数据缺失', code: 400 };
    }

    const cleanNick = nickname.trim().slice(0, 20);
    const submission = {
      nickname: cleanNick,
      tag: tag.trim(),
      scores: this._sanitizeScores(scores),
      weightScore: null,
      submittedAt: Date.now()
    };
    this.storage.set('submission:' + cleanNick, submission);
    this.logger.info('[inn-welcome] 提交: ' + cleanNick + ' / ' + tag);

    const pointsConfig = this.getPointsConfig();
    if (pointsConfig.participationReward > 0 && this.eventBus) {
      this.eventBus.emit('user:award-points', {
        nickname: cleanNick, amount: pointsConfig.participationReward,
        reason: '参与活动：客栈迎新', activityId: 'inn-welcome'
      });
    }

    return { success: true, submission };
  }

  _sanitizeScores(scores) {
    const out = {};
    for (const g of this.getGames()) {
      const s = scores[g.id];
      if (!s || s.score == null || s.score === '' || isNaN(Number(s.score))) {
        out[g.id] = null;
        continue;
      }
      out[g.id] = {
        score: Number(s.score),
        rank: s.rank == null ? null : Number(s.rank),
        sort: s.sort === 'asc' ? 'asc' : 'desc',
        unit: s.unit || '',
        total: s.total == null ? null : Number(s.total)
      };
    }
    return out;
  }

  /** 列出全部提交，按提交时间倒序 */
  listSubmissions() {
    const items = this.storage.list('submission:').map(i => i.value).filter(Boolean);
    items.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return items;
  }

  /** 删除一条提交记录（管理员清理用） */
  deleteSubmission(nickname) {
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
      return { error: '昵称不能为空', code: 400 };
    }
    const cleanNick = nickname.trim().slice(0, 20);
    const key = 'submission:' + cleanNick;
    if (!this.storage.has(key)) {
      return { error: '该昵称无提交记录', code: 404 };
    }
    this.storage.delete(key);
    this.logger.info('[inn-welcome] 删除提交: ' + cleanNick);
    return { success: true, nickname: cleanNick };
  }

  /** 读取当前权重（无则用配置默认值） */
  getWeights() {
    const stored = this.storage.get('weights');
    if (stored && typeof stored === 'object') return stored;
    const def = {};
    for (const g of this.getGames()) def[g.id] = g.weight != null ? g.weight : 0.2;
    return def;
  }

  /**
   * 设置游戏权重并重算全部提交的权重分
   * 归一化：desc/sum → 玩家分/最佳分；asc → 最佳分/玩家分；无成绩或最佳为0 → 0
   * @param {Object} weights { gameId: number }
   */
  computeWeights(weights) {
    if (!weights || typeof weights !== 'object') {
      return { error: '权重数据缺失', code: 400 };
    }
    const norm = {};
    for (const g of this.getGames()) {
      const w = Number(weights[g.id]);
      norm[g.id] = isNaN(w) ? (g.weight != null ? g.weight : 0.2) : Math.max(0, w);
    }
    this.storage.set('weights', norm);

    const submissions = this.listSubmissions();

    // 每游戏所有提交中的最佳成绩
    const best = {};
    for (const g of this.getGames()) {
      let b = null;
      for (const sub of submissions) {
        const sc = sub.scores && sub.scores[g.id];
        if (!sc || sc.score == null) continue;
        if (b === null) b = sc.score;
        else if (sc.sort === 'asc') b = Math.min(b, sc.score);
        else b = Math.max(b, sc.score);
      }
      best[g.id] = b;
    }

    // 归一化 + 加权求和
    for (const sub of submissions) {
      let ws = 0;
      for (const g of this.getGames()) {
        const sc = sub.scores && sub.scores[g.id];
        const w = norm[g.id];
        if (!sc || sc.score == null || best[g.id] == null || best[g.id] === 0) continue;
        let n = sc.sort === 'asc' ? best[g.id] / sc.score : sc.score / best[g.id];
        if (n > 1) n = 1; // 最佳者归一化为 1，防止越界
        if (n < 0) n = 0;
        ws += w * n;
      }
      sub.weightScore = Math.round(ws * 1000) / 1000;
      this.storage.set('submission:' + sub.nickname, sub);
    }

    return { success: true, weights: norm, submissions: this.listSubmissions() };
  }

  /** 按权重分加权无放回抽样 */
  runLottery(count) {
    const n = parseInt(count, 10);
    if (!n || n < 1) return { error: '抽奖人数必须为正整数', code: 400 };

    const pool = this.listSubmissions()
      .filter(s => (s.weightScore || 0) > 0)
      .map(s => ({ nickname: s.nickname, tag: s.tag, weightScore: s.weightScore, weight: Math.max(s.weightScore || 0, 0.0001) }));

    if (pool.length === 0) {
      return { error: '暂无有效提交，请先计算权重分', code: 400 };
    }

    const k = Math.min(n, pool.length);
    const winners = [];
    for (let i = 0; i < k; i++) {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = (crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff) * total;
      let idx = 0;
      for (let j = 0; j < pool.length; j++) {
        r -= pool[j].weight;
        if (r <= 0) { idx = j; break; }
        idx = j;
      }
      winners.push({ nickname: pool[idx].nickname, tag: pool[idx].tag, weightScore: pool[idx].weightScore });
      pool.splice(idx, 1);
    }

    const result = { winners, count: k, drawnAt: Date.now() };
    this.storage.set('lottery:result', result);
    this.logger.info('[inn-welcome] 抽奖完成，中奖 ' + k + ' 人');
    return { success: true, ...result };
  }

  getLotteryResult() {
    return this.storage.get('lottery:result') || null;
  }

  // ===== 积分系统配置 =====

  /** 读取全局积分配置（activities/config.json 的 pointsConfig） */
  getPointsConfig() {
    try {
      const global = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      return { ...DEFAULT_POINTS_CONFIG, ...(global.pointsConfig || {}) };
    } catch (e) {
      this.logger.warn('[inn-welcome] 读取全局积分配置失败: ' + e.message);
      return { ...DEFAULT_POINTS_CONFIG };
    }
  }

  /** 保存全局积分配置（合并写入 activities/config.json） */
  setPointsConfig(payload) {
    try {
      const global = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      const current = { ...DEFAULT_POINTS_CONFIG, ...(global.pointsConfig || {}) };
      if (payload.participationReward != null)
        current.participationReward = Math.max(0, Number(payload.participationReward) || 0);
      if (payload.directRewardCost != null)
        current.directRewardCost = Math.max(1, Number(payload.directRewardCost) || 50);
      if (Array.isArray(payload.directRewardPool))
        current.directRewardPool = payload.directRewardPool.map(s => String(s).trim()).filter(Boolean);
      global.pointsConfig = current;
      fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(global, null, 2), 'utf8');
      this.logger.info('[inn-welcome] 积分配置已更新');
      return { success: true, pointsConfig: current };
    } catch (e) {
      this.logger.error('[inn-welcome] 保存积分配置失败: ' + e.message);
      return { error: '保存失败: ' + e.message, code: 500 };
    }
  }

  /** 直通奖励卡：扣减积分（事件总线 callback）→ 从奖品池随机抽奖 */
  directReward(nickname) {
    if (!nickname || typeof nickname !== 'string' || !nickname.trim())
      return { error: '昵称不能为空', code: 400 };
    const cleanNick = nickname.trim().slice(0, 20);
    const config = this.getPointsConfig();
    if (!config.directRewardPool || config.directRewardPool.length === 0)
      return { error: '奖品池未配置', code: 400 };

    let deductResult = null;
    this.eventBus.emit('user:deduct-points', {
      nickname: cleanNick,
      amount: config.directRewardCost,
      reason: '直通奖励卡兑换',
      activityId: 'inn-welcome',
      callback: (r) => { deductResult = r; }
    });

    if (!deductResult || deductResult.error) {
      return { error: (deductResult && deductResult.error) || '扣减失败', code: 400 };
    }

    // 随机抽取奖品
    const prize = config.directRewardPool[
      crypto.randomInt(0, config.directRewardPool.length)
    ];

    // 记录领取历史
    const historyKey = 'direct-reward:' + cleanNick;
    const history = this.storage.get(historyKey) || [];
    history.push({ prize, cost: config.directRewardCost, timestamp: Date.now() });
    this.storage.set(historyKey, history);

    this.logger.info('[inn-welcome] 直通奖励: ' + cleanNick + ' → ' + prize);
    return { success: true, reward: prize, remainingPoints: deductResult.points.total };
  }
}

module.exports = InnWelcomeService;
