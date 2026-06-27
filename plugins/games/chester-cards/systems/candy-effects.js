/**
 * 切斯特牌 - 糖果效果实现模块
 * 从 candy-system.js 拆分，实现 23 种效果类型
 *
 * 效果分类：
 *   简单效果（15种）：在 applyEffect 中直接计算
 *   永久状态效果（3种）：读取糖果实例的 _permMult/_permChips
 *   时机钩子效果（5种）：mythic_factory/mythic_machine/mythic_magician/candy_king/hand_modifier
 *     这 5 种在 candy-system.js 的时机钩子中处理，此处返回 null
 *
 * context 参数（由调用方传入）：
 *   playedCards: []          出牌列表
 *   deckUsed: 0              牌库已使用张数
 *   isLastPlayOfRound: false 是否本关最后一次出牌
 *   prevPlayHandType: null   本关上一次出牌的牌型 key
 *   maxCandies: 5            最大槽位
 *   candyCount: 3            当前糖果数
 *   isPreview: false         是否预览模式
 */

import { RANK_VALUES, RED_SUITS } from '../core/deck.js';

/**
 * 应用单个糖果效果，返回增量
 * @returns {Object} { baseAdd, multAdd, multMul, scoreBonus, triggered }
 */
export function applyEffect(effect, baseResult, candy, context = {}) {
  const { handType } = baseResult;
  const playedCards = context.playedCards || [];
  const isPreview = context.isPreview || false;

  switch (effect.type) {
    // ========== 已有类型 ==========
    case 'mult_bonus':
      return { multAdd: effect.value, triggered: { candy, msg: `+${effect.value} 倍率` } };

    case 'mult_conditional':
      if (handType && handType.key === effect.handType) {
        return { multAdd: effect.value, triggered: { candy, msg: `${handType.name} +${effect.value} 倍率` } };
      }
      return {};

    case 'score_conditional':
      if (handType && handType.key === effect.handType) {
        return { scoreBonus: effect.value, triggered: { candy, msg: `${handType.name} +${effect.value}` } };
      }
      return {};

    case 'mult_chance':
      if (isPreview) {
        return { triggered: { candy, msg: `${Math.round(effect.chance * 100)}% ×${effect.mult} 机会`, isChance: true } };
      }
      if (Math.random() < effect.chance) {
        return { multMul: effect.mult, triggered: { candy, msg: `幸运 ×${effect.mult}` } };
      }
      return {};

    // ========== 新增：条件倍率 ==========
    case 'mult_size':
      if (playedCards.length > 0 && playedCards.length <= effect.maxSize) {
        return { multAdd: effect.value, triggered: { candy, msg: `${playedCards.length}张牌 +${effect.value} 倍率` } };
      }
      return {};

    // ========== 新增：点数加成 ==========
    case 'per_rank': {
      const matched = playedCards.filter(c => effect.ranks.includes(c.rank));
      if (matched.length === 0) return {};
      const chips = (effect.chips || 0) * matched.length;
      const mult = (effect.mult || 0) * matched.length;
      const msg = `${matched.length}×${effect.ranks.join('/')} +${chips}筹码+${mult}倍率`;
      return { chipsAdd: chips, multAdd: mult, triggered: { candy, msg } };
    }

    case 'per_rank_mult': {
      const matched = playedCards.filter(c => effect.ranks.includes(c.rank));
      if (matched.length === 0) return {};
      // 每张匹配牌确定性 ×mult 倍率（乘法叠加：×mult^count）
      const totalMul = Math.pow(effect.mult, matched.length);
      return { multMul: totalMul, triggered: { candy, msg: `${matched.length}张${effect.ranks.join('')} ×${totalMul}` } };
    }

    case 'per_parity': {
      const matched = playedCards.filter(c => isParity(c.rank, effect.parity));
      if (matched.length === 0) return {};
      const chips = (effect.chips || 0) * matched.length;
      const mult = (effect.mult || 0) * matched.length;
      const label = effect.parity === 'odd' ? '奇数' : '偶数';
      return { chipsAdd: chips, multAdd: mult, triggered: { candy, msg: `${matched.length}张${label} +${chips}筹码+${mult}倍率` } };
    }

    case 'min_rank_to_mult': {
      if (playedCards.length === 0) return {};
      const minVal = Math.min(...playedCards.map(c => RANK_VALUES[c.rank]));
      return { multAdd: minVal, triggered: { candy, msg: `最低点数 +${minVal} 倍率` } };
    }

    // ========== 新增：花色条件 ==========
    case 'mult_color': {
      if (playedCards.length === 0) return {};
      const allRed = playedCards.every(c => RED_SUITS.has(c.suit));
      const allBlack = playedCards.every(c => !RED_SUITS.has(c.suit));
      if (allRed || allBlack) {
        return { multMul: effect.value, triggered: { candy, msg: `同色 ×${effect.value}` } };
      }
      return {};
    }

    case 'mult_4suits': {
      if (playedCards.length < 4) return {};
      const suits = new Set(playedCards.map(c => c.suit));
      if (suits.size >= 4) {
        return { multMul: effect.value, triggered: { candy, msg: `四花色 ×${effect.value}` } };
      }
      return {};
    }

    // ========== 新增：槽位/状态条件 ==========
    case 'mult_empty_slot': {
      const emptySlots = Math.max(0, (context.maxCandies || 5) - (context.candyCount || 0));
      if (emptySlots > 0) {
        const total = effect.value * emptySlots;
        return { multMul: total, triggered: { candy, msg: `${emptySlots}空槽 ×${total}` } };
      }
      return {};
    }

    case 'mult_same_hand': {
      if (context.prevPlayHandType && handType && handType.key === context.prevPlayHandType) {
        return { multMul: effect.value, triggered: { candy, msg: `连出同牌型 ×${effect.value}` } };
      }
      return {};
    }

    case 'mult_last_play': {
      if (context.isLastPlayOfRound) {
        return { multMul: effect.value, triggered: { candy, msg: `最后出牌 ×${effect.value}` } };
      }
      return {};
    }

    case 'mult_deck_used': {
      const deckUsed = context.deckUsed || 0;
      if (deckUsed > 0) {
        return { multAdd: deckUsed * effect.value, triggered: { candy, msg: `牌库-${deckUsed} +${deckUsed * effect.value} 倍率` } };
      }
      return {};
    }

    // ========== 永久状态效果（读取实例状态） ==========
    case 'permanent_mult_play': {
      const permMult = candy._permMult || 0;
      if (permMult !== 0) {
        return { multAdd: permMult, triggered: { candy, msg: `永久 +${permMult} 倍率` } };
      }
      return {};
    }

    case 'permanent_chips_hand': {
      const permChips = candy._permChips || 0;
      if (permChips > 0) {
        return { chipsAdd: permChips, triggered: { candy, msg: `永久 +${permChips} 筹码` } };
      }
      return {};
    }

    case 'permanent_mult_hand': {
      const permMult = candy._permMult || 0;
      if (permMult > 0) {
        return { multAdd: permMult, triggered: { candy, msg: `永久 +${permMult} 倍率` } };
      }
      return {};
    }

    // 糖果王：在出牌时应用 _kingMult 倍率（累乘），应用后清零
    case 'candy_king': {
      const kingMult = candy._kingMult || 1;
      if (kingMult > 1) {
        candy._kingMult = 1; // 应用后重置
        return { multMul: kingMult, triggered: { candy, msg: `糖果王 ×${kingMult}` } };
      }
      return {};
    }

    // ========== 时机钩子效果（此处不处理，返回空） ==========
    // mythic_factory: 回合结束时处理（candy-hooks.js）
    // mythic_machine: 回合开始时处理（candy-hooks.js）
    // mythic_magician: 出牌时处理（candy-hooks.js，影响牌型升级）
    // hand_modifier: evaluateHand 之前处理（待 hand-evaluator 集成）
    case 'mythic_factory':
    case 'mythic_machine':
    case 'mythic_magician':
    case 'hand_modifier':
      return {};

    // ========== 已有但不在出牌时处理 ==========
    case 'coin_per_round':
      return {};

    default:
      console.warn('[chester] 未知糖果效果类型:', effect.type);
      return {};
  }
}

/** 判断牌的点数奇偶性 */
function isParity(rank, parity) {
  const val = RANK_VALUES[rank];
  if (parity === 'odd') return val % 2 === 1;
  return val % 2 === 0;
}
