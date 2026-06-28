/**
 * 建筑数据（Phase 1：A 主题季宝库 + B 星妙之路）
 * C 炮塔（速射/狙击/治疗/加伤）预留 2 个建造位
 *
 * 地图为纵向固定布局，建筑位坐标在 game.js 的 LAYOUT 中定义
 */
export const BUILDINGS = {
  // A：主题季宝库 —— 持续产出金币 + 6 级解锁英雄合并
  'vault': {
    id: 'vault',
    name: '主题季宝库',
    code: 'A',
    type: 'economy',
    desc: '持续产出金币，6 级解锁英雄合并',
    levels: [
      { level: 1, goldPerSec: 8 },
      { level: 2, goldPerSec: 14 },
      { level: 3, goldPerSec: 21 },
      { level: 4, goldPerSec: 30 },
      { level: 5, goldPerSec: 42 },
      { level: 6, goldPerSec: 58 },     // 解锁 5→6 合并 + 批量招募 + 批量合并
      { level: 7, goldPerSec: 78 },
      { level: 8, goldPerSec: 105 },
      { level: 9, goldPerSec: 140 },
      { level: 10, goldPerSec: 180 }    // 解锁 6→7 合并
    ],
    upgradeCost: [150, 300, 500, 800, 1200, 1800, 2600, 3800, 5500],
    upgradeWaves: [1, 5, 10, 20, 30, 40, 55, 70, 90],
    maxLevel: 10,
    // 英雄合并配置
    merge: {
      star5to6: { unlockLevel: 6, baseCost: 800 },    // 2 个 5 星 → 1 个 6 星，单次基础花费
      star6to7: { unlockLevel: 10, baseCost: 3000 },  // 2 个 6 星 → 1 个 7 星
      batchUnlockLevel: 6                              // 6 级解锁批量招募
    },
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

/** C 类炮塔（旧 Phase 1 占位数据，实际使用 data/facilities.js） */
export const FACILITIES = {
  'turret': {
    id: 'turret', name: '速射炮塔', code: 'C', cost: 120, duration: 60,
    desc: '快速攻击，中距离，单体', color: '#e76f51',
    enabled: false
  },
  'cannon': {
    id: 'cannon', name: '狙击炮塔', code: 'C', cost: 220, duration: 4,
    desc: '慢速高伤，超远距离，留火焰', color: '#e63946',
    enabled: false
  },
  'healer': {
    id: 'healer', name: '治疗炮塔', code: 'C', cost: 180,
    desc: '圆形范围回血+提高生命上限', color: '#06d6a0',
    enabled: false
  },
  'amplifier': {
    id: 'amplifier', name: '加伤炮塔', code: 'C', cost: 200, duration: 90,
    desc: '英雄攻击+30%，结束自动报废', color: '#9b5de5',
    enabled: false
  }
};

/** 固定建造位数（C 类设施，Phase 2 启用） */
export const FACILITY_SLOTS = 2;

export function findBuilding(id) {
  return BUILDINGS[id] || FACILITIES[id] || null;
}
