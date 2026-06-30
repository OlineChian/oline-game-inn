/**
 * 切斯特牌 - 入口与状态机（无尽模式）
 * 状态流转：idle → candyChoice → playing → roundWin(→shop→下一关) / roundLose / quit
 * 排行榜提交时机：失败或主动退出时提交 totalScore
 */

import { createDeck, shuffle, drawCards, sortHand } from './core/deck.js';
import { scoreHand, upgradeHandType } from './core/scoring.js';
import { getTarget } from './core/targets.js';
import {
  getPlaysForRound, getDiscardsForRound,
  getDeckCount, isDeckUpgradeRound, getDeckTotalCards
} from './data/deck-tiers.js';
import {
  renderGame, renderHand, renderHUD,
  renderLivePreview, showScorePopup, renderEndScreen, hideEndScreen, renderStartScreen
} from './ui/render.js';
import { setupInteraction } from './ui/interaction.js';
import { renderWaveChoice } from './ui/panel-render.js';
import {
  applyCandiesToScore, applyCandiesPerRound, hasHandModifier
} from './systems/candy-system.js';
import {
  handlePlayEnd, handleDiscard, handleRoundStart, handleRoundEnd
} from './systems/candy-hooks.js';
import { settleRoundCoins } from './systems/economy.js';
import { getChoiceCandies } from './systems/shop-system.js';
import { getCandyById } from './data/candies.js';
import { renderCandyChoice, hideShop } from './ui/shop-ui.js';
import { createShopActions } from './systems/shop-actions.js';
import { createSessionActions } from './systems/session-actions.js';
import { submitAndRefresh, submitWithNickname } from './leaderboard-submit.js';

const CONFIG = {
  handSize: 8,
  maxPlay: 5,
  discardsPerRound: 2,
  playsPerRound: 4,
  maxCandies: 5
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
  playsPerRound: CONFIG.playsPerRound,    // 当前关出牌上限（Wave 增长，由 startRound 计算）
  discardsPerRound: CONFIG.discardsPerRound,  // 当前关弃牌上限
  phase: 'idle',
  candies: [],
  handLevels: {},  // 牌型升级等级表 { HAND_KEY: level }，默认全部 1 级
  prevPlayHandType: null,  // 本关上一次出牌的牌型 key（金砖巧克力用）
  _firstPlayOfRound: true,  // 本关是否还未出牌（糖果魔术师用）
  shopLevel: 1              // 阶段 8：商店等级（1-5）
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

/** 出牌（应用糖果效果 + 永久状态更新） */
function playSelected() {
  if (State.phase !== 'playing') return;
  if (State.selected.size === 0 || State.playsLeft <= 0) return;

  const played = State.hand.filter(c => State.selected.has(c.id));
  const baseResult = scoreHand(played, State.handLevels, {
    allowShortHand: hasHandModifier(State.candies, 'short_hand')
  });
  const context = {
    playedCards: played,
    deckUsed: getDeckTotalCards(State.round) - State.deck.length,
    isLastPlayOfRound: State.playsLeft <= 1,
    prevPlayHandType: State.prevPlayHandType,
    maxCandies: CONFIG.maxCandies,
    candyCount: State.candies.length
  };
  const result = applyCandiesToScore(baseResult, State.candies, context);
  State.roundScore += result.score;
  State.totalScore += result.score;
  State.playsLeft--;

  // 出牌后钩子：永久状态更新 + 糖果魔术师牌型升级
  handlePlayEnd(State, played, baseResult.handType, upgradeHandType);
  // 记录本次出牌牌型，供下一次出牌的金砖巧克力检查
  State.prevPlayHandType = baseResult.handType ? baseResult.handType.key : null;

  // 补牌
  const need = State.selected.size;
  State.hand = State.hand.filter(c => !State.selected.has(c.id));
  const fresh = drawCards(State.deck, need);
  State.hand = sortHand(State.hand.concat(fresh));  // 自动理牌
  State.selected.clear();

  renderAll();
  showScorePopup(result);

  if (State.playsLeft <= 0) {
    setTimeout(endRound, 1200);
  }
}

/** 弃牌（更新糖果永久状态 + 糖果王下关倍率） */
function discardSelected() {
  if (State.phase !== 'playing') return;
  if (State.selected.size === 0 || State.discardsLeft <= 0) return;

  const discarded = State.hand.filter(c => State.selected.has(c.id));
  handleDiscard(State, discarded);

  const need = State.selected.size;
  State.hand = State.hand.filter(c => !State.selected.has(c.id));
  const fresh = drawCards(State.deck, need);
  State.hand = sortHand(State.hand.concat(fresh));  // 自动理牌
  State.selected.clear();
  State.discardsLeft--;
  renderAll();
}

/** 结束本关（结算金币，达标进入商店，未达标游戏结束并提交排行榜）
 * 无尽模式：无通关上限，失败时提交 totalScore 到排行榜
 */
async function endRound() {
  const target = getTarget(State.round);
  if (State.roundScore >= target) {
    // 过关 → 糖果工厂产出（获得随机糖果或金币）
    handleRoundEnd(State, CONFIG);
    const settle = settleRoundCoins(State.roundScore, target, State.round);
    State.coins += settle.coins;
    State.lastCoinGain = settle.coins;
    State.phase = 'roundWin';
    renderAll();
    renderEndScreen(State, CONFIG);
  } else {
    // 未达标 → 游戏结束 → 提交排行榜
    State.phase = 'roundLose';
    State.lastCoinGain = 0;
    renderAll();
    const nickname = localStorage.getItem('gameNickname');
    if (nickname && nickname.trim()) {
      await submitAndRefresh(State, CONFIG, nickname.trim());
    } else {
      renderEndScreen(State, CONFIG);
    }
  }
}

/** 玩家主动退出：提交当前分数到排行榜后显示结算界面 */
async function quitGame() {
  if (State.phase === 'idle' || State.phase === 'candyChoice') return;
  if (State.totalScore <= 0) { startGame(); return; }
  State.phase = 'quit';
  renderAll();
  const nickname = localStorage.getItem('gameNickname');
  if (nickname && nickname.trim()) {
    await submitAndRefresh(State, CONFIG, nickname.trim());
  } else {
    renderEndScreen(State, CONFIG);
  }
}

/** 关闭商店并进入下一关
 * 阶段 6：清除幸运加成状态（lucky-cookie 已在 openShop 时激活并使用）
 * Wave 重构：若下一关为换副节点（50/100/200/300...），弹窗让玩家选择"现在结束"或"继续挑战"
 */
function closeShop() {
  hideShop();
  State._luckyBonus = 1;
  State._activeLuckyBonus = 1;
  const nextRound = State.round + 1;
  if (isDeckUpgradeRound(nextRound)) {
    State.phase = 'waveChoice';
    renderWaveChoice(nextRound, getDeckCount(nextRound));
    return;
  }
  proceedNextRound();
}

/** 进入下一关（不经过 wave 弹窗的常规路径） */
function proceedNextRound() {
  State.round++;
  startRound();
}

/** 开始一关（应用回合开始钩子 + 每回合糖果效果）
 * Wave 重构：副数由 getDeckCount(State.round) 决定（50/100/200/300 换副节点）
 */
function startRound() {
  State.deck = shuffle(createDeck(getDeckCount(State.round)));
  State.hand = sortHand(drawCards(State.deck, CONFIG.handSize));  // 自动理牌
  State.selected = new Set();
  State.roundScore = 0;
  State.playsPerRound = getPlaysForRound(State.round);
  State.discardsPerRound = getDiscardsForRound(State.round);
  State.playsLeft = State.playsPerRound;
  State.discardsLeft = State.discardsPerRound;
  State.phase = 'playing';
  State._firstPlayOfRound = true;
  State.prevPlayHandType = null;  // 本关出牌牌型记录清空（金砖巧克力用）
  // 糖果机器：回合开始回收右侧糖果
  handleRoundStart(State, CONFIG);
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
  State.prevPlayHandType = null;
  State._firstPlayOfRound = true;
  State.shopLevel = 1;  // 阶段 8：重置商店等级
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

/** 打开商店、购买、抽选、回收、升级牌型等操作已拆分到 shop-actions.js */

/** 重新开始 */
function restart() {
  startGame();
}

/** 全量渲染 */
function renderAll() {
  renderHUD(State, CONFIG);
  renderHand(State);
  renderLivePreview(State, CONFIG);
}

/** 商店操作集合（工厂模式，注入 State/CONFIG/renderAll） */
const shopActions = createShopActions(State, CONFIG, renderAll);

/** 会话操作集合（wave 选择 / 设置 / 临时存档 / 功成身退 / 糖果面板 / 继续游戏） */
const sessionActions = createSessionActions(State, CONFIG, renderAll, {
  startRound,
  renderGame,
  quitGame
});

/** 初始化 */
function init() {
  renderStartScreen();
  setupInteraction({
    onSelect: toggleSelect,
    onPlay: playSelected,
    onDiscard: discardSelected,
    onRestart: restart,
    onQuit: quitGame,
    onStart: startGame,
    onPickCandy: pickStartingCandy,
    onBuyCandy: shopActions.buyCandy,
    onSellCandy: shopActions.sellCandy,
    onCloseShop: closeShop,
    onOpenShop: shopActions.openShop,
    onUpgradeHand: shopActions.upgradeHand,
    onRefreshShop: shopActions.refreshShop,
    onBuySpecialItem: shopActions.buySpecialItem,
    onUpgradeShop: shopActions.upgradeShop,
    onSubmitScore: () => submitWithNickname(State, CONFIG),
    ...sessionActions  // onToggleCandyPanel/onOpenSettings/onCloseSettings/onTempSave/onRetire/onConfirmRetire/onCancelRetire/onContinueWave/onEndWave/onContinueGame
  });
}

document.addEventListener('DOMContentLoaded', init);
