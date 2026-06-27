/**
 * 切斯特牌 - 糖果时机钩子
 * 处理在出牌/弃牌/回合开始/回合结束等时机点的糖果效果
 *
 * 钩子类型：
 *   onPlayEnd    - 出牌后：更新永久状态（牛奶糖/榛果巧克力/太妃糖/糖果魔术师）
 *   onDiscard    - 弃牌后：更新牛奶糖（-1倍率）和糖果王（存储下关倍率）
 *   onRoundStart - 回合开始：处理糖果机器（回收右侧糖果）
 *   onRoundEnd   - 回合结束：处理糖果工厂（获得随机糖果）
 *
 * 永久状态字段：
 *   candy._permMult  - 永久倍率（牛奶糖/太妃糖/糖果机器）
 *   candy._permChips - 永久筹码（榛果巧克力）
 *   candy._kingMult  - 糖果王下关倍率（累乘）
 */

import { CANDIES } from '../data/candies.js';
import { canAddCandy } from './candy-system.js';

/**
 * 出牌后钩子：更新糖果永久状态
 * - 牛奶糖（permanent_mult_play）：永久 +perPlay 倍率
 * - 榛果巧克力（permanent_chips_hand）：若打出 STRAIGHT，永久 +value 筹码
 * - 太妃糖（permanent_mult_hand）：若打出 TWO_PAIR，永久 +value 倍率
 * - 糖果魔术师（mythic_magician）：每关第一次出牌有 chance 概率升级该牌型一级
 * @param {Array} candies 糖果列表（会被直接修改实例状态）
 * @param {Array} playedCards 出牌
 * @param {Object} handType 牌型对象
 * @param {Object} ctx 上下文 { isFirstPlayOfRound }
 * @returns {Object} { handUpgrade, triggered }
 */
export function onPlayEnd(candies, playedCards, handType, ctx = {}) {
  const triggered = [];
  let handUpgrade = null;
  const isFirstPlayOfRound = ctx.isFirstPlayOfRound !== false;

  for (const candy of candies) {
    const e = candy.effect;
    switch (e.type) {
      case 'permanent_mult_play': {
        const inc = e.perPlay || 0;
        candy._permMult = (candy._permMult || 0) + inc;
        if (inc !== 0) triggered.push({ candy, msg: `永久 +${inc} 倍率` });
        break;
      }
      case 'permanent_chips_hand': {
        if (handType && handType.key === e.handType) {
          candy._permChips = (candy._permChips || 0) + (e.value || 0);
          triggered.push({ candy, msg: `永久 +${e.value} 筹码` });
        }
        break;
      }
      case 'permanent_mult_hand': {
        if (handType && handType.key === e.handType) {
          candy._permMult = (candy._permMult || 0) + (e.value || 0);
          triggered.push({ candy, msg: `永久 +${e.value} 倍率` });
        }
        break;
      }
      case 'mythic_magician': {
        if (isFirstPlayOfRound && handType && Math.random() < (e.chance || 0.25)) {
          handUpgrade = handType.key;
          triggered.push({ candy, msg: `升级 ${handType.name} 一级` });
        }
        break;
      }
    }
  }
  return { handUpgrade, triggered };
}

/**
 * 弃牌后钩子
 * - 牛奶糖（permanent_mult_play）：永久 -|perDiscard| 倍率
 * - 糖果王（candy_king）：存储弃掉的指定点数牌作为下关倍率（累乘到 _kingMult）
 * @param {Array} candies 糖果列表
 * @param {Array} discardedCards 弃牌
 * @returns {Object} { kingMult, triggered }
 */
export function onDiscard(candies, discardedCards) {
  const triggered = [];
  let kingMult = 1;

  for (const candy of candies) {
    const e = candy.effect;
    if (e.type === 'permanent_mult_play') {
      const dec = Math.abs(e.perDiscard || 0);
      candy._permMult = (candy._permMult || 0) - dec;
      if (dec > 0) triggered.push({ candy, msg: `永久 -${dec} 倍率` });
    } else if (e.type === 'candy_king') {
      const ranks = e.ranks || [];
      const matched = discardedCards.filter(c => ranks.includes(c.rank));
      for (const card of matched) {
        kingMult *= card.value;
        triggered.push({ candy, msg: `弃${card.rank} 下关×${card.value}` });
      }
      candy._kingMult = (candy._kingMult || 1) * kingMult;
    }
  }
  return { kingMult, triggered };
}

/**
 * 回合开始钩子
 * - 糖果机器（mythic_machine）：回收右侧糖果，永久获得其售价 ×2 的倍率
 * @param {Array} candies 糖果列表
 * @param {Object} ctx { maxCandies }
 * @returns {Object} { removedCandyIdx, permMultGain, triggered }
 */
export function onRoundStart(candies, ctx = {}) {
  const triggered = [];
  let removedCandyIdx = -1;
  let permMultGain = 0;

  for (const candy of candies) {
    if (candy.effect.type !== 'mythic_machine') continue;
    if (candies.length < 2) continue;
    // 右侧糖果：最后一个（不能是糖果机器自己）
    const idx = candies.length - 1;
    const right = candies[idx];
    if (right.id === candy.id) continue;
    removedCandyIdx = idx;
    permMultGain = (right.price || 0) * 2;
    candy._permMult = (candy._permMult || 0) + permMultGain;
    triggered.push({ candy, msg: `回收${right.name} +${permMultGain} 倍率` });
    break; // 一回合只处理一个糖果机器
  }
  return { removedCandyIdx, permMultGain, triggered };
}

/**
 * 回合结束钩子
 * - 糖果工厂（mythic_factory）：随机获得 1 个史诗糖果；槽位满时获得 coinIfFull 金币
 * @param {Array} candies 糖果列表
 * @param {Object} ctx { maxCandies }
 * @returns {Object} { newCandy, coinBonus, triggered }
 */
export function onRoundEnd(candies, ctx = {}) {
  const triggered = [];
  let newCandy = null;
  let coinBonus = 0;

  const epicPool = CANDIES.filter(c => c.rarity === 'epic');

  for (const candy of candies) {
    if (candy.effect.type !== 'mythic_factory') continue;
    if (canAddCandy(candies, ctx.maxCandies || 5) && epicPool.length > 0) {
      newCandy = epicPool[Math.floor(Math.random() * epicPool.length)];
      triggered.push({ candy, msg: `获得 ${newCandy.name}` });
    } else {
      coinBonus += candy.effect.coinIfFull || 0;
      triggered.push({ candy, msg: `+${candy.effect.coinIfFull} 金币` });
    }
  }
  return { newCandy, coinBonus, triggered };
}

/**
 * 整合：出牌后处理所有糖果钩子
 * - 更新永久状态（牛奶糖/榛果巧克力/太妃糖）
 * - 处理糖果魔术师牌型升级
 * - 重置 _firstPlayOfRound
 * @param {Object} state 游戏状态
 * @param {Array} playedCards 出牌
 * @param {Object} handType 牌型对象
 * @param {Function} upgradeHandType 牌型升级函数
 * @returns {Object} { handUpgrade, triggered }
 */
export function handlePlayEnd(state, playedCards, handType, upgradeHandType) {
  const hook = onPlayEnd(state.candies, playedCards, handType, {
    isFirstPlayOfRound: state._firstPlayOfRound
  });
  if (hook.handUpgrade && upgradeHandType) {
    state.handLevels = upgradeHandType(state.handLevels, hook.handUpgrade);
  }
  state._firstPlayOfRound = false;
  return hook;
}

/**
 * 整合：弃牌后处理所有糖果钩子
 * @param {Object} state 游戏状态
 * @param {Array} discardedCards 弃牌
 * @returns {Object} { kingMult, triggered }
 */
export function handleDiscard(state, discardedCards) {
  return onDiscard(state.candies, discardedCards);
}

/**
 * 整合：回合开始处理所有糖果钩子
 * - 处理糖果机器（回收右侧糖果）
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 * @returns {Object} { removedIdx, permMultGain, triggered }
 */
export function handleRoundStart(state, config) {
  const hook = onRoundStart(state.candies, { maxCandies: config.maxCandies });
  if (hook.removedCandyIdx >= 0) {
    state.candies.splice(hook.removedCandyIdx, 1);
  }
  return hook;
}

/**
 * 整合：回合结束处理所有糖果钩子
 * - 处理糖果工厂（获得随机糖果或金币）
 * @param {Object} state 游戏状态
 * @param {Object} config 配置
 * @returns {Object} { newCandy, coinBonus, triggered }
 */
export function handleRoundEnd(state, config) {
  const hook = onRoundEnd(state.candies, { maxCandies: config.maxCandies });
  if (hook.newCandy) {
    state.candies.push(hook.newCandy);
  }
  if (hook.coinBonus > 0) {
    state.coins += hook.coinBonus;
  }
  return hook;
}
