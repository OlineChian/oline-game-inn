/**
 * 英雄合并系统（宝库 6 级解锁）
 * - 5→6：2 个相同 5 星英雄实例 → 1 个 6 星（属性 = 5 星当前 × 250% 血/伤，攻速 × 150%）
 * - 6→7：2 个相同 6 星英雄实例 → 1 个 7 星（属性 = 6 星当前 × 300% 血/伤，攻速 × 200%）
 * - 合并花费金币，宝库等级越高花费越低（最低 50%）
 * - 9 级解锁批量 100 合 50
 * - 合并后保留主体实例（hp 恢复满），消耗客体实例
 */
import { Game } from '../core/game.js';
import { BUILDINGS } from '../data/buildings.js';
import { Heroes } from './heroes.js';

const STAR5TO6 = 'star5to6';
const STAR6TO7 = 'star6to7';

export const Merging = {
  /** 检查指定合并类型是否已解锁 */
  isUnlocked(type) {
    const cfg = BUILDINGS['vault'].merge[type];
    return Game.buildings.vault.level >= cfg.unlockLevel;
  },

  /** 9 级解锁批量 100 合 50 */
  isBatchUnlocked() {
    return Game.buildings.vault.level >= BUILDINGS['vault'].merge.batchUnlockLevel;
  },

  /** 单次合并金币花费（含宝库等级折扣，最低 50%） */
  unitCost(type) {
    const cfg = BUILDINGS['vault'].merge[type];
    const vaultLv = Game.buildings.vault.level;
    const discount = Math.max(0.5, 1 - (vaultLv - cfg.unlockLevel) * 0.15);
    return Math.floor(cfg.baseCost * discount);
  },

  /** 获取可合并英雄实例（按英雄 id 分组，仅 ≥2 个的） */
  getMergeableHeroes(type) {
    const targetStar = type === STAR5TO6 ? 5 : 6;
    const groups = {};
    Game.entities.heroes.forEach(h => {
      if (h.star !== targetStar) return;
      if (!groups[h.id]) groups[h.id] = { id: h.id, name: h.name, color: h.color, instances: [] };
      groups[h.id].instances.push(h);
    });
    return Object.values(groups).filter(g => g.instances.length >= 2);
  },

  /** 可选合并数量（产出数）：1/3/5，9 级追加 50；不足则剔除 */
  availableCounts(type, heroId) {
    const group = this.getMergeableHeroes(type).find(g => g.id === heroId);
    if (!group) return [];
    const pairs = Math.floor(group.instances.length / 2);   // 可产出数量
    const base = [1, 3, 5];
    if (this.isBatchUnlocked()) base.push(50);
    return base.map(n => ({ n, enabled: pairs >= n }));
  },

  /** 执行合并：消耗 count×2 个英雄实例，产出 count 个升星英雄；扣除金币 */
  merge(type, heroId, count) {
    if (!this.isUnlocked(type)) return { ok: false, msg: '宝库等级不足' };
    const counts = this.availableCounts(type, heroId);
    const opt = counts.find(c => c.n === count);
    if (!opt || !opt.enabled) return { ok: false, msg: '可合并数量不足' };
    const cost = this.unitCost(type) * count;
    if (Game.state.gold < cost) return { ok: false, msg: '金币不足' };

    const newStar = type === STAR5TO6 ? 6 : 7;
    const group = this.getMergeableHeroes(type).find(g => g.id === heroId);
    const pool = group.instances.slice();
    let produced = 0;
    for (let i = 0; i < count; i++) {
      const main = pool[i * 2];
      const sub = pool[i * 2 + 1];
      if (!main || !sub) break;
      main.star = newStar;
      Heroes._applyStar(main);   // 用统一星级公式重算（含 6/7 星倍率与 buff）
      const subIdx = Game.entities.heroes.indexOf(sub);
      if (subIdx >= 0) Game.entities.heroes.splice(subIdx, 1);
      produced++;
    }
    Game.state.gold -= cost;
    return { ok: true, produced, cost };
  }
};
