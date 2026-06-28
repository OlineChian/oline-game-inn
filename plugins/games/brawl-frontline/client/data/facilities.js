/**
 * C 类炮塔数据（4 种，统称炮塔；杰西超级技能召唤的仍叫炮台）
 * 数据驱动：属性由数据定义，行为在 systems/facilities.js 按 type 字段分发
 *
 * 炮塔类型：
 *   - attacker：自动攻击射程内敌人（速射炮塔/狙击炮塔）
 *   - healer：周期性治疗范围内英雄（治疗炮塔）
 *   - booster：光环效果，范围内英雄伤害提升（加伤炮塔）
 *
 * 建造规则：
 *   - 占用 1 个 facilitySlot（共 2 个建造位）
 *   - 消耗金币，再次点击已建造位可回收（半价退款）
 *   - 每次回收后全局价格 +20%、属性 +15%
 *   - 炮塔有独立 hp，被敌人攻击至 0 后消失
 */
export const FACILITIES = {
  // 速射炮塔：中速自动攻击，性价比高
  'turret': {
    id: 'turret', name: '速射炮塔', type: 'attacker',
    hpRate: 1.0, damage: 40, range: 160, attackSpeed: 1.2,
    projectileSpeed: 380,
    cost: 200, color: '#2ec4b6', radius: 16,
    desc: '自动攻击射程内敌人'
  },
  // 狙击炮塔：高伤害远程狙击，攻速慢
  'cannon': {
    id: 'cannon', name: '狙击炮塔', type: 'attacker',
    hpRate: 1.0, damage: 120, range: 250, attackSpeed: 0.4,
    projectileSpeed: 500,
    cost: 350, color: '#e63946', radius: 18,
    desc: '高伤害远程狙击'
  },
  // 治疗炮塔：周期性治疗范围内英雄（血量更高 hpRate×1.5）
  'healer': {
    id: 'healer', name: '治疗炮塔', type: 'healer',
    hpRate: 1.5, heal: 30, range: 120, attackSpeed: 0.8,
    cost: 300, color: '#06d6a0', radius: 16,
    desc: '治疗范围内英雄'
  },
  // 加伤炮塔：光环效果，范围内英雄伤害+30%（血量更高 hpRate×1.5）
  'amplifier': {
    id: 'amplifier', name: '加伤炮塔', type: 'booster',
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
