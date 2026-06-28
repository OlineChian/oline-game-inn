/**
 * C 类战场设施数据（4 种）
 * 数据驱动：属性由数据定义，行为在 systems/facilities.js 按 type 字段分发
 *
 * 设施类型：
 *   - attacker：自动攻击射程内敌人（炮台/舰炮）
 *   - healer：周期性治疗范围内英雄（治疗台）
 *   - booster：光环效果，范围内英雄伤害提升（伤害放大器）
 *
 * 建造规则：
 *   - 占用 1 个 facilitySlot（共 2 个建造位）
 *   - 消耗金币，不可拆除（可被敌人摧毁后重建）
 *   - 设施有独立 hp，被敌人攻击至 0 后消失
 */
export const FACILITIES = {
  // 炮台：中速自动攻击，性价比高
  'turret': {
    id: 'turret', name: '炮台', type: 'attacker',
    hpRate: 1.0, damage: 40, range: 160, attackSpeed: 1.2,
    projectileSpeed: 380,
    cost: 200, color: '#2ec4b6', radius: 16,
    desc: '自动攻击射程内敌人'
  },
  // 舰炮：高伤害远程狙击，攻速慢
  'cannon': {
    id: 'cannon', name: '舰炮', type: 'attacker',
    hpRate: 1.0, damage: 120, range: 250, attackSpeed: 0.4,
    projectileSpeed: 500,
    cost: 350, color: '#e63946', radius: 18,
    desc: '高伤害远程狙击'
  },
  // 治疗台：周期性治疗范围内英雄（血量更高 hpRate×1.5）
  'healer': {
    id: 'healer', name: '治疗台', type: 'healer',
    hpRate: 1.5, heal: 30, range: 120, attackSpeed: 0.8,
    cost: 300, color: '#06d6a0', radius: 16,
    desc: '治疗范围内英雄'
  },
  // 伤害放大器：光环效果，范围内英雄伤害+30%（血量更高 hpRate×1.5）
  'amplifier': {
    id: 'amplifier', name: '伤害放大器', type: 'booster',
    hpRate: 1.5, damageBoost: 0.3, range: 140,
    cost: 280, color: '#f72585', radius: 16,
    desc: '范围内英雄伤害+30%'
  }
};

/** 建造位数量（与 LAYOUT.facilitySlots 对应） */
export const FACILITY_SLOT_COUNT = 2;

export function findFacility(id) {
  return FACILITIES[id] || null;
}
