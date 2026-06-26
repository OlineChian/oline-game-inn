/**
 * 切斯特牌 - 经济系统
 * 阶段 3：每关金币结算
 * 公式：floor(本关得分 / 100) + 超目标奖励 5
 */

/**
 * 结算本关金币
 * @param {number} roundScore 本关得分
 * @param {number} target 目标分
 * @returns {{ coins: number, base: number, bonus: number }}
 */
export function settleRoundCoins(roundScore, target) {
  const base = Math.floor(roundScore / 100);
  const bonus = roundScore >= target ? 5 : 0;
  return { coins: base + bonus, base, bonus };
}
