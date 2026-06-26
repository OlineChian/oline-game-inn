/**
 * 强化数据池（Phase 1：基础强化）
 * 击杀达 40 触发三选一，品质分普通/稀有/史诗/神话/传奇
 *
 * effect 字段定义强化效果，由 systems/buffs.js 的 apply 方法消费
 * Phase 1 简化为 4 种品质，Phase 2 扩充为 5 品质 + 设施相关强化
 */
export const BUFF_POOL = [
  // ---- 普通 ----
  {
    id: 'gold-plus-15', name: '金币产出 +15%', quality: 'common',
    effect: { type: 'gold-rate', value: 0.15 },
    desc: '主题季宝库金币产量提升 15%'
  },
  {
    id: 'hero-atk-10', name: '英雄攻击 +10%', quality: 'common',
    effect: { type: 'hero-atk-rate', value: 0.10 },
    desc: '所有英雄攻击力提升 10%'
  },
  {
    id: 'hero-hp-10', name: '英雄生命 +10%', quality: 'common',
    effect: { type: 'hero-hp-rate', value: 0.10 },
    desc: '所有英雄最大生命提升 10%'
  },
  // ---- 稀有 ----
  {
    id: 'gold-plus-25', name: '金币产出 +25%', quality: 'rare',
    effect: { type: 'gold-rate', value: 0.25 },
    desc: '主题季宝库金币产量提升 25%'
  },
  {
    id: 'hero-atk-20', name: '英雄攻击 +20%', quality: 'rare',
    effect: { type: 'hero-atk-rate', value: 0.20 },
    desc: '所有英雄攻击力提升 20%'
  },
  {
    id: 'hero-speed-15', name: '英雄攻速 +15%', quality: 'rare',
    effect: { type: 'hero-aspd-rate', value: 0.15 },
    desc: '所有英雄攻击速度提升 15%'
  },
  {
    id: 'base-hp-200', name: '基地生命 +200', quality: 'rare',
    effect: { type: 'base-hp-flat', value: 200 },
    desc: '基地最大生命值 +200'
  },
  // ---- 史诗 ----
  {
    id: 'hero-atk-30', name: '英雄攻击 +30%', quality: 'epic',
    effect: { type: 'hero-atk-rate', value: 0.30 },
    desc: '所有英雄攻击力提升 30%'
  },
  {
    id: 'super-charge-30', name: '超能充能 +30%', quality: 'epic',
    effect: { type: 'super-charge-rate', value: 0.30 },
    desc: '超级技能充能速度提升 30%'
  },
  {
    id: 'gold-kill-2', name: '击杀金币 +2', quality: 'epic',
    effect: { type: 'kill-gold-flat', value: 2 },
    desc: '每次击杀额外获得 2 金币'
  },
  // ---- 神话 ----
  {
    id: 'hero-atk-50', name: '英雄攻击 +50%', quality: 'mythic',
    effect: { type: 'hero-atk-rate', value: 0.50 },
    desc: '所有英雄攻击力提升 50%'
  },
  {
    id: 'hero-hp-30', name: '英雄生命 +30%', quality: 'mythic',
    effect: { type: 'hero-hp-rate', value: 0.30 },
    desc: '所有英雄最大生命提升 30%'
  }
];

/** 品质权重（三选一时按权重抽取，品质越高概率越低） */
export const QUALITY_WEIGHTS = {
  common: 50,
  rare: 30,
  epic: 15,
  mythic: 5
};

/** 品质颜色（游戏内容色，非主题色） */
export const QUALITY_COLORS = {
  common: '#9aa0a6',
  rare: '#3a86ff',
  epic: '#9b5de5',
  mythic: '#f4a261',
  legendary: '#ffd700'
};

/** 从池中随机抽 3 个不同强化（按品质权重） */
export function rollBuffs(count = 3) {
  const pool = [...BUFF_POOL];
  const result = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    // 按品质权重选一个品质，再从该品质中随机
    const totalWeight = pool.reduce((s, b) => s + (QUALITY_WEIGHTS[b.quality] || 0), 0);
    let r = Math.random() * totalWeight;
    let picked = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= (QUALITY_WEIGHTS[pool[j].quality] || 0);
      if (r <= 0) { picked = j; break; }
    }
    result.push(pool.splice(picked, 1)[0]);
  }
  return result;
}
