/**
 * 建筑数据（Phase 1：A 主题季宝库 + B 星妙之路）
 * C 战场设施（炮台/舰炮/治疗台/伤害放大器）预留 2 个建造位，Phase 2 实装
 *
 * 地图为纵向固定布局，建筑位坐标在 game.js 的 LAYOUT 中定义
 */
export const BUILDINGS = {
  // A：主题季宝库 —— 持续产出金币，指定波数才能升级
  'vault': {
    id: 'vault',
    name: '主题季宝库',
    code: 'A',
    type: 'economy',
    desc: '持续产出金币，指定波数才能升级',
    levels: [
      { level: 1, goldPerSec: 8 },
      { level: 2, goldPerSec: 14 },
      { level: 3, goldPerSec: 21 },
      { level: 4, goldPerSec: 30 },
      { level: 5, goldPerSec: 42 }
    ],
    upgradeCost: [150, 300, 500, 800],   // 1→2, 2→3, 3→4, 4→5
    upgradeWaves: [1, 5, 10, 20],        // 各等级升级所需波数（第1波/5波/10波/20波）
    maxLevel: 5,
    color: '#f4a261',
    accent: '#ffd9a8'
  },
  // B：星妙之路 —— 招募英雄（券）+ 升级星级（金币）
  'star-road': {
    id: 'star-road',
    name: '星妙之路',
    code: 'B',
    type: 'hero',
    desc: '使用英雄券解锁英雄，金币升级星级',
    color: '#3a86ff',
    accent: '#a9d6ff'
  }
};

/** C 类战场设施（Phase 2 实装，此处仅定义数据预留） */
export const FACILITIES = {
  'turret': {
    id: 'turret', name: '炮台', code: 'C', cost: 120, duration: 60,
    desc: '快速攻击，中距离，单体', color: '#e76f51',
    enabled: false   // Phase 2 启用
  },
  'cannon': {
    id: 'cannon', name: '舰炮', code: 'C', cost: 220, duration: 4,
    desc: '慢速高伤，超远距离，留火焰', color: '#e63946',
    enabled: false
  },
  'healer': {
    id: 'healer', name: '治疗台', code: 'C', cost: 180,
    desc: '圆形范围回血+提高生命上限', color: '#06d6a0',
    enabled: false
  },
  'amplifier': {
    id: 'amplifier', name: '伤害放大器', code: 'C', cost: 200, duration: 90,
    desc: '英雄攻击+30%，结束自动报废', color: '#9b5de5',
    enabled: false
  }
};

/** 固定建造位数（C 类设施，Phase 2 启用） */
export const FACILITY_SLOTS = 2;

export function findBuilding(id) {
  return BUILDINGS[id] || FACILITIES[id] || null;
}
