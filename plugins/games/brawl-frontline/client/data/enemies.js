/**
 * 敌人数据（4 种普通 + 1 种 Mini Boss）
 * 数据驱动：属性由数据定义，AI 行为在 systems/enemies.js 按 ai 字段分发
 *
 * 敌人 AI 类型：
 *   - rusher：直冲基地（grunt-bot / heavy-bot / shield-guard）
 *   - hunter：追击英雄，远程射击（gunner-bot）
 *   - bomber：冲向英雄群，死亡自爆（bomber-bot）
 *
 * ticketDrop 为固定掉落数量（不是概率），用于支撑英雄券百级数量级经济
 */
export const ENEMIES = {
  // 普通机器人：中速中血，基础敌人，直冲基地
  'grunt-bot': {
    id: 'grunt-bot',
    name: '机器人',
    hp: 480,
    attack: 48,
    range: 50,
    attackSpeed: 0.9,
    moveSpeed: 52,
    goldDrop: 8,
    ticketDrop: 8,
    color: '#9aa0a6',
    accent: '#c6ccd1',
    radius: 14,
    ai: 'rusher'
  },
  // 胖机器人：慢速高血，肉盾，直冲基地
  'heavy-bot': {
    id: 'heavy-bot',
    name: '胖机器人',
    hp: 1400,
    attack: 72,
    range: 55,
    attackSpeed: 0.7,
    moveSpeed: 34,
    goldDrop: 18,
    ticketDrop: 22,
    color: '#5f6368',
    accent: '#9aa0a6',
    radius: 20,
    ai: 'rusher'
  },
  // 快射手：低血高速，追击英雄，远程射击（克制无脑选远程英雄）
  'gunner-bot': {
    id: 'gunner-bot',
    name: '快射手',
    hp: 160,
    attack: 28,
    range: 140,
    attackSpeed: 1.0,
    moveSpeed: 88,
    goldDrop: 12,
    ticketDrop: 10,
    color: '#e74c3c',
    accent: '#ff9a8b',
    radius: 12,
    ai: 'hunter'
  },
  // 爆破兵：中血，冲向英雄群，死亡自爆范围伤害
  'bomber-bot': {
    id: 'bomber-bot',
    name: '爆破兵',
    hp: 300,
    attack: 70,
    range: 60,
    attackSpeed: 0.5,
    moveSpeed: 50,
    goldDrop: 15,
    ticketDrop: 14,
    color: '#f39c12',
    accent: '#ffd54f',
    radius: 16,
    ai: 'bomber'
  },
  // 盾卫：高血，正面减伤 50%，缓慢推进
  'shield-guard': {
    id: 'shield-guard',
    name: '盾卫',
    hp: 1000,
    attack: 32,
    range: 45,
    attackSpeed: 0.8,
    moveSpeed: 30,
    goldDrop: 20,
    ticketDrop: 18,
    color: '#34495e',
    accent: '#7f8c8d',
    radius: 18,
    ai: 'rusher',
    damageReduction: 0.5
  },
  // Mini Boss（第 6 波出现）：高血，会召唤
  'mega-pig': {
    id: 'mega-pig',
    name: 'Mega Pig',
    hp: 8500,
    attack: 115,
    range: 70,
    attackSpeed: 0.8,
    moveSpeed: 26,
    goldDrop: 120,
    ticketDrop: 180,
    color: '#e91e63',
    accent: '#ff9ec4',
    radius: 32,
    isBoss: true,
    ai: 'rusher',
    skill: {
      type: 'summon',
      name: '召唤小机器人',
      interval: 5,
      count: 3,
      summonId: 'grunt-bot'
    }
  },
  // 护盾 Boss：周期性获得伤害吸收护盾（无尽波次 10 出场）
  'shield-boss': {
    id: 'shield-boss',
    name: '护盾机甲',
    hp: 6000,
    attack: 90,
    range: 60,
    attackSpeed: 0.7,
    moveSpeed: 28,
    goldDrop: 100,
    ticketDrop: 150,
    color: '#1a73e8',
    accent: '#8ab6f6',
    radius: 28,
    isBoss: true,
    ai: 'rusher',
    skill: {
      type: 'shield',
      name: '能量护盾',
      interval: 6,
      shieldHp: 800,
      duration: 3
    }
  },
  // 狂暴 Boss：血量低于 50% 时狂暴（攻击+移速大幅提升，仅触发一次）
  'berserker-boss': {
    id: 'berserker-boss',
    name: '狂暴巨兽',
    hp: 7500,
    attack: 100,
    range: 65,
    attackSpeed: 0.8,
    moveSpeed: 30,
    goldDrop: 110,
    ticketDrop: 160,
    color: '#d62828',
    accent: '#ffabc1',
    radius: 30,
    isBoss: true,
    ai: 'rusher',
    skill: {
      type: 'enrage',
      name: '狂暴化',
      threshold: 0.5,
      atkBoost: 1.5,
      spdBoost: 1.8
    }
  },
  // 精英召唤 Boss：召唤精英敌人（胖机器人），比 mega-pig 更强
  'elite-summoner': {
    id: 'elite-summoner',
    name: '召唤母体',
    hp: 9000,
    attack: 85,
    range: 70,
    attackSpeed: 0.8,
    moveSpeed: 24,
    goldDrop: 130,
    ticketDrop: 200,
    color: '#6a0dad',
    accent: '#c8a2e6',
    radius: 32,
    isBoss: true,
    ai: 'rusher',
    skill: {
      type: 'summon',
      name: '精英召唤',
      interval: 4,
      count: 2,
      summonId: 'heavy-bot'
    }
  }
};

/** 波次敌人组成（1~5 普通波 + 6 Boss 波）
 *  设计原则：直冲基地（rusher）与攻击英雄（hunter+bomber）数量接近，避免一边倒
 *  第 1 波为新手适应波，第 2 波引入快射手，第 4 波引入爆破兵，第 5 波引入盾卫
 */
export const WAVES = [
  { wave: 1, enemies: [{ id: 'grunt-bot', count: 2, interval: 2.0 }] },
  { wave: 2, enemies: [
    { id: 'grunt-bot', count: 3, interval: 1.4 },
    { id: 'gunner-bot', count: 2, interval: 1.8 }
  ] },
  { wave: 3, enemies: [
    { id: 'grunt-bot', count: 4, interval: 1.1 },
    { id: 'heavy-bot', count: 1, interval: 1.8 },
    { id: 'gunner-bot', count: 3, interval: 1.3 }
  ] },
  { wave: 4, enemies: [
    { id: 'grunt-bot', count: 4, interval: 1.0 },
    { id: 'heavy-bot', count: 2, interval: 1.6 },
    { id: 'gunner-bot', count: 4, interval: 1.0 },
    { id: 'bomber-bot', count: 2, interval: 2.8 }
  ] },
  { wave: 5, enemies: [
    { id: 'grunt-bot', count: 5, interval: 0.9 },
    { id: 'heavy-bot', count: 2, interval: 1.4 },
    { id: 'gunner-bot', count: 5, interval: 0.9 },
    { id: 'bomber-bot', count: 2, interval: 2.5 },
    { id: 'shield-guard', count: 1, interval: 0 }
  ] },
  { wave: 6, enemies: [
    { id: 'mega-pig', count: 1, interval: 0 },
    { id: 'gunner-bot', count: 3, interval: 2 }
  ], isBoss: true }
];

/** 强化触发进度目标序列（累计击杀）：40 → 80 → 120 → 160 ... */
export const BUFF_TARGETS = [40, 80, 120, 160, 200, 240, 280, 320];

export function findEnemy(id) {
  return ENEMIES[id] || null;
}
