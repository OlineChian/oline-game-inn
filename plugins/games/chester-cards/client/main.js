/**
 * 切斯特牌 - 入口与状态机
 * 阶段 3：开局三选一 + 每关结算金币 + 商店购买
 * 状态流转：idle → candyChoice → playing → roundWin/roundLose → shop/victory
 */

import { createDeck, shuffle, drawCards } from './core/deck.js';
import { scoreHand, upgradeHandType, upgradeCost } from './core/scoring.js';
import {
  renderGame, renderHand, renderHUD, renderCandies,
  renderLivePreview, showScorePopup, renderEndScreen, hideEndScreen, renderStartScreen
} from './ui/render.js';
import { setupInteraction } from './ui/interaction.js';
import {
  applyCandiesToScore, applyCandiesPerRound, canAddCandy
} from './systems/candy-system.js';
import { settleRoundCoins } from './systems/economy.js';
import {
  getChoiceCandies, drawRandomCandy, getRandomDrawPrice, canAfford, sellPrice
} from './systems/shop-system.js';
import {
  renderCandyChoice, renderShop, hideShop, setDrawnCandy, resetDrawnCandy
} from './ui/shop-ui.js';
import { getCandyById } from './data/candies.js';

const CONFIG = {
  rounds: 8,
  handSize: 8,
  maxPlay: 5,
  discardsPerRound: 2,
  playsPerRound: 4,
  maxCandies: 5,
  targets: [300, 600, 1000, 1500, 2200, 3000, 4000, 5500]
};

const State = {
  deck: [],
  hand: [],
  selected: new Set(),
  round: 1,
  roundScore: 0,
  totalScore: 0,
  coins: 0,
  lastCoinGain: 0,
  playsLeft: CONFIG.playsPerRound,
  discardsLeft: CONFIG.discardsPerRound,
  phase: 'idle',
  candies: [],
  handLevels: {}  // 牌型升级等级表 { HAND_KEY: level }，默认全部 1 级
};

/** 切换选牌 */
function toggleSelect(cardId) {
  if (State.phase !== 'playing') return;
  if (State.selected.has(cardId)) {
    State.selected.delete(cardId);
  } else {
    if (State.selected.size >= CONFIG.maxPlay) return;
    State.selected.add(cardId);
  }
  renderAll();
}

/** 出牌（应用糖果效果） */
function playSelected() {
  if (State.phase !== 'playing') return;
  if (State.selected.size === 0 || State.playsLeft <= 0) return;

  const played = State.hand.filter(c => State.selected.has(c.id));
  const baseResult = scoreHand(played, State.handLevels);
  const result = applyCandiesToScore(baseResult, State.candies);
  State.roundScore += result.score;
  State.totalScore += result.score;
  State.playsLeft--;

  // 补牌
  const need = State.selected.size;
  State.hand = State.hand.filter(c => !State.selected.has(c.id));
  const fresh = drawCards(State.deck, need);
  State.hand = State.hand.concat(fresh);
  State.selected.clear();

  renderAll();
  showScorePopup(result);

  if (State.playsLeft <= 0) {
    setTimeout(endRound, 1200);
  }
}

/** 弃牌 */
function discardSelected() {
  if (State.phase !== 'playing') return;
  if (State.selected.size === 0 || State.discardsLeft <= 0) return;

  const need = State.selected.size;
  State.hand = State.hand.filter(c => !State.selected.has(c.id));
  const fresh = drawCards(State.deck, need);
  State.hand = State.hand.concat(fresh);
  State.selected.clear();
  State.discardsLeft--;
  renderAll();
}

/** 结束本关（结算金币，不再免费奖励糖果）
 * 胜利时若已有昵称，先渲染「提交中」，await 真实提交结果后再回写状态
 * 避免 fire-and-forget 吞掉错误导致 UI 误导
 */
async function endRound() {
  const target = CONFIG.targets[State.round - 1];
  if (State.roundScore >= target) {
    const settle = settleRoundCoins(State.roundScore, target);
    State.coins += settle.coins;
    State.lastCoinGain = settle.coins;
    if (State.round >= CONFIG.rounds) {
      State.phase = 'victory';
      const nickname = localStorage.getItem('gameNickname');
      if (nickname && nickname.trim()) {
        // 先渲染提交中状态，让用户看到正在提交
        renderAll();
        renderEndScreen(State, CONFIG, { submitState: 'submitting' });
        const ok = await submitScoreToLeaderboard(nickname.trim());
        renderEndScreen(State, CONFIG, { submitState: ok ? 'success' : 'fail' });
        return;
      }
    } else {
      State.phase = 'roundWin';
    }
  } else {
    State.phase = 'roundLose';
    State.lastCoinGain = 0;
  }
  renderAll();
  renderEndScreen(State, CONFIG);
}

/** 关闭商店并进入下一关 */
function closeShop() {
  hideShop();
  State.round++;
  startRound();
}

/** 开始一关（应用每回合糖果效果） */
function startRound() {
  State.deck = shuffle(createDeck());
  State.hand = drawCards(State.deck, CONFIG.handSize);
  State.selected = new Set();
  State.roundScore = 0;
  State.playsLeft = CONFIG.playsPerRound;
  State.discardsLeft = CONFIG.discardsPerRound;
  State.phase = 'playing';
  // 应用每回合糖果效果（金币等）
  const roundBonus = applyCandiesPerRound(State.candies);
  State.coins += roundBonus.coinBonus;
  hideEndScreen();
  renderAll();
}

/** 开始游戏（首屏 → 三选一选初始糖果） */
function startGame() {
  State.round = 1;
  State.totalScore = 0;
  State.coins = 0;
  State.lastCoinGain = 0;
  State.candies = [];
  State.handLevels = {};
  renderGame(CONFIG);
  const choices = getChoiceCandies(1, 3);
  renderCandyChoice(choices, CONFIG);
  State.phase = 'candyChoice';
}

/** 三选一：选择初始糖果 */
function pickStartingCandy(candyId) {
  if (State.phase !== 'candyChoice') return;
  if (State.candies.length > 0) return;
  const candy = getCandyById(candyId);
  if (!candy) return;
  State.candies.push(candy);
  hideShop();
  startRound();
}

/** 打开商店（从胜利界面进入） */
function openShop() {
  if (State.phase !== 'roundWin') return;
  hideEndScreen();
  resetDrawnCandy();
  renderShop(State, CONFIG);
}

/** 商店：指定糖果购买 */
function buyCandy(candyId, price) {
  if (State.phase !== 'roundWin') return;
  const candy = getCandyById(candyId);
  if (!candy) return;
  if (!canAfford(State.coins, price)) return;
  if (!canAddCandy(State.candies, CONFIG.maxCandies)) return;
  if (State.candies.some(c => c.id === candyId)) return;
  State.coins -= price;
  State.candies.push(candy);
  renderShop(State, CONFIG);
  renderAll();
}

/** 商店：随机抽选（按权重递减，先抽后扣以防池空） */
function drawRandom() {
  if (State.phase !== 'roundWin') return;
  const price = getRandomDrawPrice(State.round);
  if (!canAfford(State.coins, price)) return;
  if (!canAddCandy(State.candies, CONFIG.maxCandies)) return;
  const candy = drawRandomCandy(State.round);
  if (!candy) return;
  State.coins -= price;
  State.candies.push(candy);
  setDrawnCandy(candy);
  renderShop(State, CONFIG);
  renderAll();
}

/** 商店：回收糖果（半价 floor(price/2) 返还） */
function sellCandy(candyId) {
  if (State.phase !== 'roundWin') return;
  const idx = State.candies.findIndex(c => c.id === candyId);
  if (idx < 0) return;
  const candy = State.candies[idx];
  const refund = sellPrice(candy);
  State.candies.splice(idx, 1);
  State.coins += refund;
  renderShop(State, CONFIG);
  renderAll();
}

/** 商店：升级牌型（花费金币提升某牌型等级，永久生效至本局结束） */
function upgradeHand(handKey) {
  if (State.phase !== 'roundWin') return;
  const cost = upgradeCost(State.handLevels, handKey);
  if (!canAfford(State.coins, cost)) return;
  State.coins -= cost;
  State.handLevels = upgradeHandType(State.handLevels, handKey);
  renderShop(State, CONFIG);
  renderAll();
}

/** 重新开始 */
function restart() {
  startGame();
}

/** 排行榜：提交分数到服务器（参考 8bit-arcade 简化版） */
async function submitScoreToLeaderboard(nickname) {
  if (!nickname || !nickname.trim()) return false;
  if (!window.ScoreSigner) {
    console.warn('[chester] ScoreSigner 未加载，跳过成绩提交');
    return false;
  }
  try {
    const sig = await window.ScoreSigner.sign({
      gameId: 'chester-cards',
      nickname,
      score: State.totalScore
    });
    const response = await fetch('/api/leaderboard/chester-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score: State.totalScore,
        extra: {
          rounds: CONFIG.rounds,
          candies: State.candies.length,
          coins: State.coins,
          handLevels: State.handLevels
        },
        timestamp: sig.timestamp,
        nonce: sig.nonce,
        signature: sig.signature
      })
    });
    const data = await response.json();
    if (!data.success) {
      console.warn('[chester] 成绩提交失败:', data.error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[chester] 排行榜提交失败:', e);
    return false;
  }
}

/** 用户点击"提交成绩"按钮：读取输入框昵称，提交后重渲染 */
async function submitScoreWithNickname() {
  const input = document.getElementById('ccNicknameInput');
  if (!input) return;
  const nickname = input.value.trim();
  if (!nickname) return;
  localStorage.setItem('gameNickname', nickname);
  renderEndScreen(State, CONFIG, { submitState: 'submitting' });
  const ok = await submitScoreToLeaderboard(nickname);
  renderEndScreen(State, CONFIG, { submitState: ok ? 'success' : 'fail' });
}

/** 全量渲染 */
function renderAll() {
  renderHUD(State, CONFIG);
  renderHand(State);
  renderCandies(State, CONFIG);
  renderLivePreview(State, CONFIG);
}

/** 初始化 */
function init() {
  renderStartScreen();
  setupInteraction({
    onSelect: toggleSelect,
    onPlay: playSelected,
    onDiscard: discardSelected,
    onRestart: restart,
    onStart: startGame,
    onPickCandy: pickStartingCandy,
    onBuyCandy: buyCandy,
    onDrawRandom: drawRandom,
    onSellCandy: sellCandy,
    onCloseShop: closeShop,
    onOpenShop: openShop,
    onUpgradeHand: upgradeHand,
    onSubmitScore: submitScoreWithNickname
  });
}

document.addEventListener('DOMContentLoaded', init);
