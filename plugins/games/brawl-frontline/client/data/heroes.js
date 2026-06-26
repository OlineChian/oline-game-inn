/**
 * 英雄数据（Phase 1：4 位）
 * 数据与逻辑分离：属性、超级技能描述由数据驱动，技能效果在 systems/heroes.js 实现
 *
 * 星级成长：每升 1 星，hp ×1.2、attack ×1.15（在 heroes.js 系统 applyStar 计算）
 * 超级技能充能：每次普攻命中 +chargePerHit，满 1.0 自动释放
 * 超级技能解锁：3 星及以上方可释放（1/2 星充能条存在但灰显）
 * 招募消耗：100 英雄券（券数量级为百级，敌人掉落固定数量）
 * 全局升星：同种类英雄共享星级（state.heroStars[id]），新招募即带当前星级
 */
export const HEROES = [
  {
    id: 'shelly',
    name: '雪莉',
    role: '近战',
    faction: 'Starr Force',
    star: 1,
    hp: 900,
    attack: 70,
    range: 90,
    attackSpeed: 1.1,      // 每秒攻击次数
    moveSpeed: 62,         // 像素/秒
    projectileSpeed: 0,    // 0 = 近战即时命中
    cost: { tickets: 100 },
    color: '#e74c8b',
    accent: '#ffd1e6',
    super: {
      name: '超级技能：扇形爆发',
      type: 'cone',
      damage: 220,
      angle: 60,           // 扇形半角（度）
      radius: 140,
      chargePerHit: 0.28
    }
  },
  {
    id: 'colt',
    name: '柯尔特',
    role: '射手',
    faction: 'Starr Force',
    star: 1,
    hp: 620,
    attack: 58,
    range: 230,
    attackSpeed: 1.6,
    moveSpeed: 58,
    projectileSpeed: 420,
    cost: { tickets: 100 },
    color: '#3a86ff',
    accent: '#a9d6ff',
    super: {
      name: '超级技能：弹幕风暴',
      type: 'barrage',
      damage: 60,
      shots: 8,
      chargePerHit: 0.24
    }
  },
  {
    id: 'bull',
    name: '公牛',
    role: '坦克',
    faction: '矿场',
    star: 1,
    hp: 1500,
    attack: 55,
    range: 70,
    attackSpeed: 0.85,
    moveSpeed: 50,
    projectileSpeed: 0,
    cost: { tickets: 100 },
    color: '#f4a261',
    accent: '#ffd9a8',
    super: {
      name: '超级技能：蛮牛冲锋',
      type: 'charge',
      damage: 180,
      distance: 200,
      chargePerHit: 0.22
    }
  },
  {
    id: 'jessie',
    name: '杰西',
    role: '召唤',
    faction: '机器人',
    star: 1,
    hp: 720,
    attack: 50,
    range: 180,
    attackSpeed: 1.0,
    moveSpeed: 55,
    projectileSpeed: 360,
    cost: { tickets: 100 },
    color: '#2ec4b6',
    accent: '#a8e6e0',
    super: {
      name: '超级技能：炮台召唤',
      type: 'turret',
      damage: 30,
      turretHp: 400,
      duration: 8,
      chargePerHit: 0.26
    }
  }
];

/** 升级消耗（金币），按目标星级索引（1→2, 2→3, 3→4, 4→5） */
export const STAR_UPGRADE_COST = [120, 220, 380, 600];

/** 星级成长系数 */
export const STAR_GROWTH = { hp: 1.2, attack: 1.15 };

/** 超级技能解锁星级（达到此星级才能释放超级技能） */
export const SUPER_UNLOCK_STAR = 3;

/** 起始可选英雄数（3 选 1） */
export const INITIAL_HERO_CHOICES = 3;

export function findHero(id) {
  return HEROES.find(h => h.id === id) || null;
}
