'use strict';

/**
 * 巅峰双重挑战 - 抽奖算法与权重计算
 * - getRankBonus: 排名加分表
 * - calculateWeight: 归一化权重
 * - calculateProbability: 动态概率
 * - performDraw: 执行抽奖
 */

const crypto = require('crypto');

function getRankBonus(rank) {
  if (rank == null) return 100;
  if (rank === 1) return 500;
  if (rank === 2) return 450;
  if (rank === 3) return 420;
  if (rank <= 10) return 380;
  if (rank <= 20) return 340;
  if (rank <= 50) return 300;
  if (rank <= 100) return 250;
  if (rank <= 300) return 180;
  return 100;
}

function calculateWeight(gameAScore, gameARank, gameBScore, gameBRank, topA, topB) {
  const normA = topA > 0 ? (gameAScore / topA) * 1000 : 0;
  const normB = topB > 0 ? (gameBScore / topB) * 1000 : 0;
  const rankBonus = getRankBonus(gameARank) + getRankBonus(gameBRank);
  return Math.round(0.4 * normA + 0.4 * normB + 0.2 * rankBonus);
}

function calculateProbability(config, isPityDraw) {
  const { remainPrize, totalGuaranteedDraw, currentDrawCount } = config;
  if (remainPrize <= 0) return 0;
  if (isPityDraw) return 1.0;
  const remainingBudget = totalGuaranteedDraw - currentDrawCount;
  if (remainingBudget <= 0) return 0;
  return Math.min(1, remainPrize / remainingBudget);
}

function performDraw(player, config) {
  const isPityDraw = (player.drawCount + 1) >= config.maxDrawsPerPlayer;
  const p = calculateProbability(config, isPityDraw);
  const roll = crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff;
  const won = roll < p;
  return { won, probability: p, isPityDraw };
}

module.exports = { getRankBonus, calculateWeight, calculateProbability, performDraw };
