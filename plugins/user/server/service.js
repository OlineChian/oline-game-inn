/**
 * 用户系统业务逻辑服务
 * 职责：积分管理（单积分体系，含流水记录）
 *
 * 存储结构：points:${nickname} → { total: number, history: Array<Entry> }
 *   Entry: { type:'award'|'deduct', amount:number, reason:string, activityId:string, timestamp:number }
 */

class UserService {
  constructor(context) {
    this.storage = context.storage;
    this.eventBus = context.eventBus;
    this.logger = context.logger;
    this.config = context.config;
    this.maxHistory = this.config.maxHistoryLength || 100;
  }

  /**
   * 获取用户积分（不存在则初始化）
   */
  getPoints(nickname) {
    const key = `points:${nickname}`;
    let points = this.storage.get(key);
    if (!points || typeof points.total !== 'number') {
      points = { total: 0, history: [] };
      this.storage.set(key, points);
    }
    return points;
  }

  /**
   * 增加积分（参与活动奖励等）
   */
  addPoints(nickname, amount, reason, activityId) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.getPoints(nickname);
    }
    const points = this.getPoints(nickname);
    points.total += amount;
    points.history.push({
      type: 'award',
      amount: amount,
      reason: reason || '',
      activityId: activityId || '',
      timestamp: Date.now()
    });
    this._trimHistory(points);
    this.storage.set(`points:${nickname}`, points);
    return points;
  }

  /**
   * 扣减积分（直通奖励卡等）
   * @returns {{success:true,points:object}|{error:string,code:number}}
   */
  deductPoints(nickname, amount, reason, activityId) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: '扣减数量无效', code: 400 };
    }
    const points = this.getPoints(nickname);
    if (points.total < amount) {
      return { error: '积分不足', code: 400 };
    }
    points.total -= amount;
    points.history.push({
      type: 'deduct',
      amount: -amount,
      reason: reason || '',
      activityId: activityId || '',
      timestamp: Date.now()
    });
    this._trimHistory(points);
    this.storage.set(`points:${nickname}`, points);
    return { success: true, points };
  }

  /**
   * 获取积分流水
   * @param {number} limit 最近条数，默认 50
   */
  getHistory(nickname, limit = 50) {
    const points = this.getPoints(nickname);
    const history = points.history || [];
    if (limit > 0 && history.length > limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * 检查是否已对某活动发放过奖励（防刷）
   */
  hasBeenRewarded(nickname, activityId) {
    if (!activityId) return false;
    return this.storage.has(`rewarded:${activityId}:${nickname}`);
  }

  /**
   * 标记已对某活动发放奖励
   */
  markRewarded(nickname, activityId) {
    if (!activityId) return;
    this.storage.set(`rewarded:${activityId}:${nickname}`, true);
  }

  _trimHistory(points) {
    if (points.history.length > this.maxHistory) {
      points.history = points.history.slice(-this.maxHistory);
    }
  }
}

module.exports = UserService;
