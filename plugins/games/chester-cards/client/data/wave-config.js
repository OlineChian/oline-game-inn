/**
 * 切斯特牌 - Wave 稀有度配置
 * 基于关卡数分段控制糖果稀有度概率，越后期稀有度越高
 *
 * Wave 1（关 1-10）：  普通 70% / 稀有 25% / 史诗 5%
 * Wave 2（关 11-30）： 普通 45% / 稀有 35% / 史诗 15% / 神话 5%
 * Wave 3（关 31+）：   普通 30% / 稀有 35% / 史诗 20% / 神话 10% / 传奇 5%
 *
 * 商店等级（阶段 8）可在此基础上叠加传奇概率加成
 */

export const WAVE_CONFIG = [
  {
    wave: 1,
    minRound: 1,
    maxRound: 10,
    weights: { common: 70, rare: 25, epic: 5, mythic: 0, legendary: 0 }
  },
  {
    wave: 2,
    minRound: 11,
    maxRound: 30,
    weights: { common: 45, rare: 35, epic: 15, mythic: 5, legendary: 0 }
  },
  {
    wave: 3,
    minRound: 31,
    maxRound: Infinity,
    weights: { common: 30, rare: 35, epic: 20, mythic: 10, legendary: 5 }
  }
];

/**
 * 获取指定关卡的 Wave 编号（1/2/3）
 * @param {number} round 当前关卡
 * @returns {number} Wave 编号
 */
export function getWaveNumber(round) {
  for (const w of WAVE_CONFIG) {
    if (round >= w.minRound && round <= w.maxRound) return w.wave;
  }
  return WAVE_CONFIG[WAVE_CONFIG.length - 1].wave;
}

/**
 * 获取指定关卡的稀有度权重
 * @param {number} round 当前关卡
 * @param {number} [shopBonus] 商店等级带来的传奇概率加成（百分比点，阶段 8 使用）
 * @returns {Object} { common, rare, epic, mythic, legendary } 权重对象
 */
export function getWaveWeights(round, shopBonus = 0) {
  let weights;
  for (const w of WAVE_CONFIG) {
    if (round >= w.minRound && round <= w.maxRound) {
      weights = { ...w.weights };
      break;
    }
  }
  if (!weights) {
    weights = { ...WAVE_CONFIG[WAVE_CONFIG.length - 1].weights };
  }
  // 商店等级传奇概率加成（阶段 8 实现，此处预留接口）
  if (shopBonus > 0 && weights.legendary !== undefined) {
    weights.legendary += shopBonus;
    // 从 common 中扣除等量以保持总和
    weights.common = Math.max(0, weights.common - shopBonus);
  }
  return weights;
}

/**
 * 获取指定关卡可用的稀有度列表（权重 > 0 的）
 * @param {number} round 当前关卡
 * @returns {string[]} 稀有度数组
 */
export function getAvailableRarities(round) {
  const weights = getWaveWeights(round);
  return Object.keys(weights).filter(r => weights[r] > 0);
}
