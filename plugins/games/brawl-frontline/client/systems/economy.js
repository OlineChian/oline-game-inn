/**
 * 经济系统：金币与英雄券的产出、消耗
 * - 主题季宝库（A）按等级持续产金，受 gold-rate buff 加成
 * - 击杀掉落金币/券，受 kill-gold-flat buff 加成
 */
import { Game } from '../core/game.js';
import { BUILDINGS } from '../data/buildings.js';

export const Economy = {
  /** 每帧累加宝库产金 */
  update(dt) {
    const vault = Game.buildings.vault;
    const data = BUILDINGS['vault'];
    const lvl = data.levels[vault.level - 1];
    const rate = lvl.goldPerSec * (1 + this._buffRate('gold-rate'));
    vault.goldAcc += rate * dt;
    if (vault.goldAcc >= 1) {
      const g = Math.floor(vault.goldAcc);
      Game.state.gold += g;
      Game.state.totalGoldEarned += g;
      vault.goldAcc -= g;
    }
  },

  /** 击杀掉落奖励：金币 + 英雄券（受 kill-gold-flat / kill-ticket-flat / kill-ticket-rate buff 加成） */
  onKill(enemy) {
    const goldGain = enemy.goldDrop + this._buffFlat('kill-gold-flat');
    Game.state.gold += goldGain;
    Game.state.totalGoldEarned += goldGain;
    const base = enemy.ticketDrop || 0;
    const tFlat = this._buffFlat('kill-ticket-flat');
    const tRate = this._buffRate('kill-ticket-rate');
    const ticketGain = Math.floor(base * (1 + tRate)) + tFlat;
    Game.state.tickets += ticketGain;
    Game.state.totalTicketsEarned += ticketGain;
  },

  addGold(n) { Game.state.gold += n; },

  spendGold(n) {
    if (Game.state.gold < n) return false;
    Game.state.gold -= n;
    return true;
  },

  addTickets(n) { Game.state.tickets += n; },

  spendTickets(n) {
    if (Game.state.tickets < n) return false;
    Game.state.tickets -= n;
    return true;
  },

  /** 汇总 buff 比率类加成 */
  _buffRate(type) {
    return Game.buffs
      .filter(b => b.effect.type === type)
      .reduce((s, b) => s + b.effect.value, 0);
  },

  /** 汇总 buff 固定值加成 */
  _buffFlat(type) {
    return Game.buffs
      .filter(b => b.effect.type === type)
      .reduce((s, b) => s + b.effect.value, 0);
  }
};
