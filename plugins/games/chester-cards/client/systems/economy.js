/**
 * 切斯特牌 - 经济系统
 * 阶段 3：每关金币结算
 * 公式：min(floor(本关得分 / 100), 8 + 关卡) + 超目标奖励 5
 * 上限随关卡线性增长，防止后期得分指数增长导致金币通胀
 */

/**
 * 结算本关金币
 * @param {number} roundScore 本关得分
 * @param {number} target 目标分
 * @param {number} round 当前关卡
 * @returns {{ coins: number, base: number, bonus: number }}
 */
export function settleRoundCoins(roundScore, target, round) {
  const cap = 8 + round;
  const base = Math.min(Math.floor(roundScore / 100), cap);
  const bonus = roundScore >= target ? 5 : 0;
  return { coins: base + bonus, base, bonus };
}
