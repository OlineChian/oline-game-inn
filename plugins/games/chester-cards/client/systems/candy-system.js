/**
 * 切斯特牌 - 糖果系统
 * 处理糖果效果应用与商店辅助逻辑
 *
 * 效果应用顺序：
 *   1. 计算 base / mult / chips（原始 scoreHand 结果）
 *   2. base_bonus 累加 → newBase
 *   3. mult_bonus + mult_conditional 累加 → newMult
 *   4. score_conditional 累加 → scoreBonus
 *   5. mult_chance 概率翻倍 newMult
 *   6. 最终得分 = (newBase + chips) × newMult + scoreBonus
 *   7. coin_per_round 在回合开始时单独处理
 */

import { CANDIES, RARITY_UNLOCK_ROUND } from '../data/candies.js';

/**
 * 出牌时应用糖果效果到得分
 * @param {Object} baseResult scoreHand 返回的原始结果
 * @param {Array} candies 玩家拥有的糖果
 * @returns {Object} 含 finalScore / triggered 列表
 */
export function applyCandiesToScore(baseResult, candies) {
  return applyCandiesInternal(baseResult, candies, false);
}

/**
 * 实时预览：选牌时计算当前牌型与分数（应用糖果效果）
 * 与 applyCandiesToScore 的区别：mult_chance 类型不实际掷骰子，
 * 仅标记为「机会加成」，避免预览分数跳动
 * @param {Object} baseResult scoreHand 返回的原始结果
 * @param {Array} candies 玩家拥有的糖果
 * @returns {Object} 含 finalScore / triggered / hasChance 列表
 */
export function previewCandiesToScore(baseResult, candies) {
  return applyCandiesInternal(baseResult, candies, true);
}

/** 内部共享实现：应用糖果效果到得分
 * @param {Object} baseResult 原始得分
 * @param {Array} candies 糖果列表
 * @param {boolean} isPreview 是否为预览模式（mult_chance 不实际触发）
 */
function applyCandiesInternal(baseResult, candies, isPreview) {
  if (!candies || candies.length === 0) {
    return { ...baseResult, triggered: [], hasChance: false };
  }

  let { base, mult, chips, handType } = baseResult;
  let newBase = base;
  let newMult = mult;
  let scoreBonus = 0;
  let hasChance = false;
  const triggered = [];

  for (const candy of candies) {
    const e = candy.effect;
    switch (e.type) {
      case 'base_bonus':
        newBase += e.value;
        triggered.push({ candy, msg: `+${e.value} 基础` });
        break;
      case 'mult_bonus':
        newMult += e.value;
        triggered.push({ candy, msg: `+${e.value} 倍率` });
        break;
      case 'score_conditional':
        if (handType && handType.key === e.handType) {
          scoreBonus += e.value;
          triggered.push({ candy, msg: `${handType.name} +${e.value}` });
        }
        break;
      case 'mult_conditional':
        if (handType && handType.key === e.handType) {
          newMult += e.value;
          triggered.push({ candy, msg: `${handType.name} +${e.value} 倍率` });
        }
        break;
      case 'mult_chance':
        if (isPreview) {
          // 预览模式：仅标记机会加成，不实际掷骰子
          hasChance = true;
          triggered.push({
            candy,
            msg: `${Math.round(e.chance * 100)}% ×${e.mult} 机会`,
            isChance: true
          });
        } else if (Math.random() < e.chance) {
          newMult *= e.mult;
          triggered.push({ candy, msg: `幸运 ×${e.mult}` });
        }
        break;
      case 'coin_per_round':
        // 出牌时不处理，由 applyCandiesPerRound 处理
        break;
    }
  }

  const finalScore = (newBase + chips) * newMult + scoreBonus;
  const bonusPart = scoreBonus ? ` + ${scoreBonus}` : '';
  return {
    ...baseResult,
    base: newBase,
    mult: newMult,
    score: finalScore,
    triggered,
    hasChance,
    formula: `(${newBase} + ${chips}) × ${newMult}${bonusPart} = ${finalScore}`
  };
}

/**
 * 回合开始时应用糖果效果（金币等持续性效果）
 * @param {Array} candies 玩家拥有的糖果
 * @returns {Object} { coinBonus, triggered }
 */
export function applyCandiesPerRound(candies) {
  let coinBonus = 0;
  const triggered = [];
  if (!candies) return { coinBonus, triggered };

  for (const candy of candies) {
    if (candy.effect.type === 'coin_per_round') {
      coinBonus += candy.effect.value;
      triggered.push({ candy, msg: `+${candy.effect.value} 金币` });
    }
  }
  return { coinBonus, triggered };
}

/**
 * 获取当前关卡的可用糖果池（按稀有度配置驱动过滤）
 * 规则：common≥1 / rare≥2 / epic≥3 / mythic≥4 / legendary≥5
 * @param {number} round 当前关卡
 * @returns {Array} 糖果数组
 */
export function getPoolForRound(round) {
  return CANDIES.filter(c => round >= RARITY_UNLOCK_ROUND[c.rarity]);
}

/**
 * 从池中随机抽取 1 张糖果
 * @param {number} round 当前关卡
 * @returns 糖果对象
 */
export function getRandomCandy(round) {
  const pool = getPoolForRound(round);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 检查是否还能添加糖果
 */
export function canAddCandy(candies, maxCandies) {
  return candies.length < maxCandies;
}
