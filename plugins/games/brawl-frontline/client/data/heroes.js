/**
 * 英雄数据（Phase 2：12 位，按稀有度分层）
 *
 * 稀有度分布：1 初始 + 3 稀有 + 5 史诗 + 2 神话 + 1 传奇 = 12
 *
 * 数值设计（用户要求：高稀有度每个数值 ≥ 上一稀有度最低值 ×150%）：
 *   - hp / attack 严格按稀有度 ×1.5 递增
 *   - range / attackSpeed / moveSpeed 保持角色定位（近战近、射手远、坦克慢）
 *   - 超级技能伤害按 atk 比例相应提升
 *
 * 解锁流程：每次从随机 3 候选中选 1 位解锁，池构成随已解锁进度动态变化
 * 星级成长：每升 1 星 hp ×1.2、attack ×1.15
 * 超级技能：3 星解锁，满充能自动释放（效果在 systems/hero-supers.js）
 */
export const RARITY_ORDER = ['starter', 'rare', 'epic', 'mythic', 'legendary'];
export const RARITY_LABEL = { starter: '初始', rare: '稀有', epic: '史诗', mythic: '神话', legendary: '传奇' };
export const RARITY_COLOR = { starter: '#95a5a6', rare: '#3498db', epic: '#9b59b6', mythic: '#e74c3c', legendary: '#f1c40f' };
export const UNLOCK_COST = { epic: 500, mythic: 800, legendary: 1200 };

export const HEROES = [
  // ============ 初始（1）— hp 900 / atk 70 ============
  {
    id: 'shelly', name: '雪莉', role: '近战', rarity: 'starter', faction: 'Starr Force',
    hp: 900, attack: 70, range: 90, attackSpeed: 1.1, moveSpeed: 88,
    projectileSpeed: 0, cost: { tickets: 100 }, color: '#e74c8b', accent: '#ffd1e6',
    super: { name: '超级技能：扇形爆发', type: 'cone', damage: 280, angle: 60, radius: 150, knockback: 80, chargePerHit: 0.28 }
  },
  // ============ 稀有（3）— hp ≥ 1350 / atk ≥ 105 ============
  {
    id: 'colt', name: '柯尔特', role: '射手', rarity: 'rare', faction: 'Starr Force',
    hp: 1400, attack: 110, range: 230, attackSpeed: 1.6, moveSpeed: 58,
    projectileSpeed: 420, cost: { tickets: 100 }, color: '#3a86ff', accent: '#a9d6ff',
    super: { name: '超级技能：三连弹幕', type: 'barrage', multiplier: 3, shots: 3, chargePerHit: 0.24 }
  },
  {
    id: 'bull', name: '公牛', role: '坦克', rarity: 'rare', faction: '矿场',
    hp: 2400, attack: 138, range: 70, attackSpeed: 0.85, moveSpeed: 50,
    projectileSpeed: 0, cost: { tickets: 100 }, color: '#f4a261', accent: '#ffd9a8',
    super: { name: '超级技能：蛮牛冲撞', type: 'charge', damage: 200, distance: 140, radius: 70, knockback: 90, stunDuration: 1.5, chargePerHit: 0.22 }
  },
  {
    id: 'jessie', name: '杰西', role: '召唤', rarity: 'rare', faction: '机器人',
    hp: 1500, attack: 108, range: 200, attackSpeed: 1.0, moveSpeed: 55,
    projectileSpeed: 360, cost: { tickets: 100 }, color: '#2ec4b6', accent: '#a8e6e0',
    bounce: { damageRate: 0.5, radius: 100 },
    // 炮台：血量未清零不消失，伤害 = 杰西普攻 ×150% = 162，射程 = 杰西 ×50% = 100，攻速 = 杰西 ×150% = 1.5
    // 一个杰西同时只能存在一个炮台（hero-supers.js 中检查 ownerId）
    super: { name: '超级技能：炮台召唤', type: 'turret', damage: 162, turretHp: 5000, chargePerHit: 0.26 }
  },
  // ============ 史诗（5）— hp ≥ 2025 / atk ≥ 157 ============
  {
    id: 'el-primo', name: '艾尔普里莫', role: '近战', rarity: 'epic', faction: 'Starr Force',
    hp: 3000, attack: 170, range: 80, attackSpeed: 1.0, moveSpeed: 70,
    projectileSpeed: 0, cost: { tickets: 150 }, color: '#e63946', accent: '#ffb4b4',
    super: { name: '超级技能：飞身重压', type: 'leap', damage: 340, radius: 110, stunDuration: 1.0, chargePerHit: 0.26 }
  },
  {
    id: 'brock', name: '布洛克', role: '射手', rarity: 'epic', faction: 'Starr Force',
    hp: 2100, attack: 190, range: 250, attackSpeed: 1.2, moveSpeed: 52,
    projectileSpeed: 420, cost: { tickets: 150 }, color: '#f77f00', accent: '#ffd8a8',
    super: { name: '超级技能：火箭轰击', type: 'rocket', damage: 380, radius: 80, chargePerHit: 0.24 }
  },
  {
    id: 'spike', name: '斯派克', role: '射手', rarity: 'epic', faction: '沙漠',
    hp: 2050, attack: 160, range: 190, attackSpeed: 1.3, moveSpeed: 60,
    projectileSpeed: 380, cost: { tickets: 150 }, color: '#06d6a0', accent: '#a8e6cf',
    super: { name: '超级技能：刺球爆发', type: 'burst', damage: 160, count: 6, chargePerHit: 0.25 }
  },
  {
    id: 'crow', name: '乌鸦', role: '近战', rarity: 'epic', faction: '沙漠',
    hp: 2200, attack: 158, range: 75, attackSpeed: 1.5, moveSpeed: 82,
    projectileSpeed: 0, cost: { tickets: 150 }, color: '#9b5de5', accent: '#d8b4fe',
    super: { name: '超级技能：毒云蔓延', type: 'poison', dps: 80, radius: 120, duration: 4, chargePerHit: 0.23 }
  },
  {
    id: 'pam', name: '帕姆', role: '治疗', rarity: 'epic', faction: '机器人',
    hp: 2800, attack: 157, range: 180, attackSpeed: 1.0, moveSpeed: 48,
    projectileSpeed: 320, cost: { tickets: 150 }, color: '#ef476f', accent: '#ffb3c6',
    super: { name: '超级技能：治愈领域', type: 'heal', heal: 600, radius: 130, chargePerHit: 0.22 }
  },
  // ============ 神话（2）— hp ≥ 3037 / atk ≥ 236 ============
  {
    id: 'frank', name: '弗兰肯', role: '坦克', rarity: 'mythic', faction: '怪物',
    hp: 4800, attack: 240, range: 80, attackSpeed: 0.6, moveSpeed: 40,
    projectileSpeed: 0, cost: { tickets: 200 }, color: '#8338ec', accent: '#c8b6ff',
    super: { name: '超级技能：眩晕冲击', type: 'stun', radius: 130, duration: 2.0, chargePerHit: 0.20 }
  },
  {
    id: 'poco', name: '波克', role: '治疗', rarity: 'mythic', faction: '沙漠',
    hp: 3100, attack: 238, range: 180, attackSpeed: 0.9, moveSpeed: 50,
    projectileSpeed: 300, cost: { tickets: 200 }, color: '#ffd166', accent: '#fff3b0',
    super: { name: '超级技能：音波治疗', type: 'heal', heal: 500, radius: 200, chargePerHit: 0.22 }
  },
  // ============ 传奇（2）— hp ≥ 4556 / atk ≥ 354 ============
  {
    id: 'tara', name: '塔拉', role: '射手', rarity: 'legendary', faction: '神秘',
    hp: 4600, attack: 360, range: 220, attackSpeed: 1.1, moveSpeed: 54,
    projectileSpeed: 350, cost: { tickets: 300 }, color: '#6a4c93', accent: '#c5b3e6',
    super: { name: '超级技能：命运召唤', type: 'summon', unitHp: 1500, unitAttack: 200, duration: 8, chargePerHit: 0.26 }
  },
  {
    id: 'bolt', name: '博尔特', role: '坦克', rarity: 'legendary', faction: '神秘',
    hp: 6500, attack: 400, range: 60, attackSpeed: 1.0, moveSpeed: 130,
    projectileSpeed: 0, cost: { tickets: 300 }, color: '#ffd166', accent: '#fff3b0',
    // 碰撞伤害型：沿随机椭圆巡逻，碰到敌人造成大量伤害（AI 在 systems/hero-bolt.js）
    // 超能：路径留下燃烧区域，伤害 = 博尔特 attack，持续 8 秒
    super: { name: '超级技能：烈焰路径', type: 'fire-trail', damage: 400, duration: 8, chargePerHit: 0.26 }
  }
];

/** 升级消耗（金币），按目标星级索引（1→2, 2→3, 3→4, 4→5） */
export const STAR_UPGRADE_COST = [120, 220, 380, 600];

/** 星级成长系数 */
export const STAR_GROWTH = { hp: 1.2, attack: 1.15 };

/** 超级技能解锁星级 */
export const SUPER_UNLOCK_STAR = 3;

/** 起始可选英雄数（3 选 1） */
export const INITIAL_HERO_CHOICES = 3;

/** 获取开局可用英雄（初始 + 稀有） */
export function getStarterHeroIds() {
  return HEROES.filter(h => h.rarity === 'starter' || h.rarity === 'rare').map(h => h.id);
}

/** 获取需要解锁的英雄（史诗 + 神话 + 传奇） */
export function getUnlockableHeroes() {
  return HEROES.filter(h => h.rarity === 'epic' || h.rarity === 'mythic' || h.rarity === 'legendary');
}

export function findHero(id) {
  return HEROES.find(h => h.id === id) || null;
}
