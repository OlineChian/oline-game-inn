/**
 * 敌人数据（Phase 1：2 种普通 + 1 种 Mini Boss）
 * 数据驱动：属性由数据定义，AI 行为在 systems/enemies.js 实现
 *
 * 敌人从地图顶部中间区域刷新，沿垂直方向直冲基地
 * 抵达 baseLine 后攻击基地，被英雄拦截时才反击英雄
 * ticketDrop 为固定掉落数量（不是概率），用于支撑英雄券百级数量级经济
 */
export const ENEMIES = {
  // 普通机器人：中速中血，基础敌人
  'grunt-bot': {
    id: 'grunt-bot',
    name: '机器人',
    hp: 320,
    attack: 38,
    range: 50,
    attackSpeed: 0.9,
    moveSpeed: 42,
    goldDrop: 8,         // 击杀掉落金币
    ticketDrop: 8,       // 击杀固定掉落英雄券数量
    color: '#9aa0a6',
    accent: '#c6ccd1',
    radius: 14
  },
  // 胖机器人：慢速高血，肉盾
  'heavy-bot': {
    id: 'heavy-bot',
    name: '胖机器人',
    hp: 950,
    attack: 58,
    range: 55,
    attackSpeed: 0.7,
    moveSpeed: 28,
    goldDrop: 18,
    ticketDrop: 22,
    color: '#5f6368',
    accent: '#9aa0a6',
    radius: 20
  },
  // Mini Boss（第 6 波出现）：高血，会召唤
  'mega-pig': {
    id: 'mega-pig',
    name: 'Mega Pig',
    hp: 6500,
    attack: 95,
    range: 70,
    attackSpeed: 0.8,
    moveSpeed: 22,
    goldDrop: 120,
    ticketDrop: 180,     // Boss 固定掉落 180 券
    color: '#e91e63',
    accent: '#ff9ec4',
    radius: 32,
    isBoss: true,
    skill: {
      type: 'summon',
      name: '召唤小机器人',
      interval: 6,       // 每 6 秒召唤
      count: 2,
      summonId: 'grunt-bot'
    }
  }
};

/** 波次敌人组成（Phase 1：1~5 普通波 + 6 Boss 波） */
export const WAVES = [
  { wave: 1, enemies: [{ id: 'grunt-bot', count: 5, interval: 1.2 }] },
  { wave: 2, enemies: [{ id: 'grunt-bot', count: 6, interval: 1.1 }, { id: 'heavy-bot', count: 1, interval: 2 }] },
  { wave: 3, enemies: [{ id: 'grunt-bot', count: 7, interval: 1.0 }, { id: 'heavy-bot', count: 2, interval: 1.8 }] },
  { wave: 4, enemies: [{ id: 'grunt-bot', count: 8, interval: 0.9 }, { id: 'heavy-bot', count: 3, interval: 1.6 }] },
  { wave: 5, enemies: [{ id: 'grunt-bot', count: 10, interval: 0.8 }, { id: 'heavy-bot', count: 4, interval: 1.4 }] },
  { wave: 6, enemies: [{ id: 'mega-pig', count: 1, interval: 0 }], isBoss: true }
];

/** 强化触发进度目标序列（累计击杀）：40 → 80 → 120 → 160 ... */
export const BUFF_TARGETS = [40, 80, 120, 160, 200, 240, 280, 320];

export function findEnemy(id) {
  return ENEMIES[id] || null;
}
