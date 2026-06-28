/**
 * 强化系统：累计击杀达 buffTarget 触发三选一
 * - open(): 暂停游戏，抽取 3 个强化，交由 UI 展示
 * - choose(buff): 应用 buff 到 Game.buffs，推进下一目标，恢复 wave 阶段
 *
 * buff.effect.type 分类：
 *   gold-rate / hero-atk-rate / hero-hp-rate / hero-aspd-rate
 *   super-charge-rate / kill-gold-flat / base-hp-flat
 */
import { Game } from '../core/game.js';
import { rollBuffs, QUALITY_COLORS } from '../data/buffs.js';

export const Buffs = {
  _choices: [],

  /** 触发三选一面板 */
  open() {
    this._choices = rollBuffs(3);
    if (Game.systems.ui && Game.systems.ui.showBuffSelect) {
      Game.systems.ui.showBuffSelect(this._choices);
    }
  },

  /** 玩家选择一个强化 */
  choose(buffId) {
    const buff = this._choices.find(b => b.id === buffId);
    if (!buff) return;
    Game.buffs.push(buff);
    this._applyImmediate(buff);
    this._choices = [];
    // 推进下一强化目标（killCounter 不重置，累计计算 40→80→120…）
    Game.advanceBuffTarget();
    Game.state.phase = 'wave';
  },

  /** 部分强化需要立即生效：
   *  - base-hp-flat：加上限并按 1.5 倍恢复血量
   *  - convert-gold-to-tickets：消耗金币按比例转换为英雄券（金币不足按比例） */
  _applyImmediate(buff) {
    if (buff.effect.type === 'base-hp-flat') {
      Game.state.baseMaxHp += buff.effect.value;
      const heal = Math.floor(buff.effect.value * 1.5);
      Game.state.baseHp = Math.min(Game.state.baseMaxHp, Game.state.baseHp + heal);
    } else if (buff.effect.type === 'convert-gold-to-tickets') {
      const gold = Math.min(Game.state.gold, buff.effect.gold);
      const tickets = Math.floor(gold * (buff.effect.tickets / buff.effect.gold));
      Game.state.gold -= gold;
      Game.state.tickets += tickets;
    }
  },

  /** 计算英雄攻击力倍率总和 */
  heroAtkRate() {
    return this._sum('hero-atk-rate');
  },
  heroHpRate() {
    return this._sum('hero-hp-rate');
  },
  heroAspdRate() {
    return this._sum('hero-aspd-rate');
  },
  superChargeRate() {
    return this._sum('super-charge-rate');
  },

  _sum(type) {
    return Game.buffs
      .filter(b => b.effect.type === type)
      .reduce((s, b) => s + b.effect.value, 0);
  },

  qualityColor(q) {
    return QUALITY_COLORS[q] || '#9aa0a6';
  }
};
