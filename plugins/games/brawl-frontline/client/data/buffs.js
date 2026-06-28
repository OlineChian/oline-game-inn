/**
 * 强化数据池
 * 击杀达 40 触发三选一，品质分普通/稀有/史诗/神话/传奇
 *
 * effect 字段定义强化效果，由 systems/buffs.js 的 apply 方法消费
 * 波数推进时：value 按 waveMult 放大；wave≥15 后不再刷新普通品质
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
    desc: '基地最大生命值 +200，并恢复 300 点生命'
  },
  {
    id: 'turret-hp-20', name: '炮塔生命 +20%', quality: 'rare',
    effect: { type: 'turret-hp-rate', value: 0.20 },
    desc: '所有炮塔最大生命提升 20%'
  },
  {
    id: 'turret-dmg-20', name: '炮塔伤害 +20%', quality: 'rare',
    effect: { type: 'turret-damage-rate', value: 0.20 },
    desc: '所有炮塔伤害提升 20%'
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
  {
    id: 'kill-ticket-1', name: '击杀英雄券 +1', quality: 'rare',
    effect: { type: 'kill-ticket-flat', value: 1 },
    desc: '每次击杀额外获得 1 英雄券'
  },
  {
    id: 'turret-hp-35', name: '炮塔生命 +35%', quality: 'epic',
    effect: { type: 'turret-hp-rate', value: 0.35 },
    desc: '所有炮塔最大生命提升 35%'
  },
  {
    id: 'turret-dmg-35', name: '炮塔伤害 +35%', quality: 'epic',
    effect: { type: 'turret-damage-rate', value: 0.35 },
    desc: '所有炮塔伤害提升 35%'
  },
  {
    id: 'kill-ticket-rate-30', name: '击杀英雄券 +30%', quality: 'mythic',
    effect: { type: 'kill-ticket-rate', value: 0.30 },
    desc: '击杀掉落的英雄券数量提升 30%'
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
  },
  // ---- 经济转换（立即生效：消耗金币获得英雄券）----
  {
    id: 'convert-g-t-500', name: '500 金币 → 200 英雄券', quality: 'common',
    effect: { type: 'convert-gold-to-tickets', gold: 500, tickets: 200 },
    desc: '立即消耗 500 金币，获得 200 英雄券（金币不足按比例转换）'
  },
  {
    id: 'convert-g-t-1000', name: '1000 金币 → 450 英雄券', quality: 'rare',
    effect: { type: 'convert-gold-to-tickets', gold: 1000, tickets: 450 },
    desc: '立即消耗 1000 金币，获得 450 英雄券（金币不足按比例转换）'
  },
  {
    id: 'convert-g-t-5000', name: '5000 金币 → 2500 英雄券', quality: 'epic',
    effect: { type: 'convert-gold-to-tickets', gold: 5000, tickets: 2500 },
    desc: '立即消耗 5000 金币，获得 2500 英雄券（金币不足按比例转换）'
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

/** 普通品质过滤的波数阈值 */
export const COMMON_FILTER_WAVE = 15;

/** 波数缩放倍率：每 10 波 +15% 数值 */
export function waveMultiplier(wave) {
  return 1 + Math.floor((wave || 0) / 10) * 0.15;
}

/** 从池中随机抽 3 个不同强化（按品质权重；wave≥15 过滤普通；value 随波数缩放） */
export function rollBuffs(count = 3, wave = 0) {
  const mult = waveMultiplier(wave);
  const filterCommon = wave >= COMMON_FILTER_WAVE;
  const pool = filterCommon
    ? BUFF_POOL.filter(b => b.quality !== 'common')
    : [...BUFF_POOL];
  const result = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, b) => s + (QUALITY_WEIGHTS[b.quality] || 0), 0);
    let r = Math.random() * totalWeight;
    let picked = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= (QUALITY_WEIGHTS[pool[j].quality] || 0);
      if (r <= 0) { picked = j; break; }
    }
    const buff = pool.splice(picked, 1)[0];
    // 缩放带 value 的数值类强化（rate/flat），convert 类不缩放
    if (buff.effect.value !== undefined) {
      const scaled = { ...buff };
      scaled.effect = { ...buff.effect, value: Math.round(buff.effect.value * mult * 100) / 100 };
      result.push(scaled);
    } else {
      result.push(buff);
    }
  }
  return result;
}
