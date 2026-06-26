'use strict';

/**
 * 客栈迎新活动 - 业务逻辑服务
 * ============================
 * 职责：
 *   - 成绩提交（同一昵称更新覆盖，一人一票）
 *   - 权重分计算（每游戏分数归一化 × 管理员设定的游戏权重，求和）
 *   - 加权抽奖（按权重分无放回抽样 N 人，crypto 随机）
 *
 * 数据分区键（inn-welcome:）：
 *   - submission:{nickname}  → 单条提交快照
 *   - weights                → { gameId: weight }
 *   - lottery:result         → 上次抽奖结果
 *
 * 成绩快照来自前端调用排行榜 API（GET /api/leaderboard/:game/user/:nickname），
 * 后端只存储快照，不跨插件访问排行榜，符合插件隔离铁律。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'activities', 'inn-welcome', 'config.json');
const DEFAULT_TAG_PATTERN = '^#[A-Z0-9]{3,10}$';

class InnWelcomeService {
  constructor(context) {
    this.storage = context.storage;
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
    return { success: true, submission };
  }

  /** 按活动配置的 5 款游戏规整成绩，缺失游戏置 null */
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

  /**
   * 按权重分加权无放回抽样
   * @param {number} count 中奖人数
   */
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
}

module.exports = InnWelcomeService;
