/**
 * 切斯特牌 - 牌库模块
 * 标准 52 张扑克牌、洗牌、发牌、牌面分
 */

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** 点数（A=14，用于牌型识别） */
export const RANK_VALUES = {
  'A': 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

/** 红色花色 */
export const RED_SUITS = new Set(['♥', '♦']);

/** 创建牌库（默认 1 副 52 张，可指定多副以支持 wave 换副）
 * @param {number} [count=1] 副数
 * @returns {Array} 牌数组
 */
export function createDeck(count = 1) {
  const deck = [];
  for (let d = 0; d < count; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit,
          rank,
          value: RANK_VALUES[rank],
          id: `${d}-${rank}${suit}`,  // 副数前缀避免多副间 id 冲突
          isRed: RED_SUITS.has(suit)
        });
      }
    }
  }
  return deck;
}

/** Fisher-Yates 洗牌 */
export function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 牌面分（出牌加分用）：A=11, J/Q/K=10, 2-10 按面值 */
export function cardChip(card) {
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return card.value;
}

/** 抽牌（从牌库顶部取 n 张） */
export function drawCards(deck, n) {
  return deck.splice(0, n);
}

/** 理牌花色顺序：♣ < ♠ < ♥ < ♦ */
const SUIT_ORDER = { '♣': 0, '♠': 1, '♥': 2, '♦': 3 };

/** 自动理牌：点数降序（A 最大），同点数按 ♣<♠<♥<♦ */
export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
  });
}
