/**
 * 英雄系统：招募、升级星级、AI、超级技能释放调度
 * - 全局升星：同种类英雄共享星级（state.heroStars[id]），新招募即带当前星级
 * - 超级技能：3 星及以上解锁，满充能自动释放（具体效果在 hero-supers.js 实现）
 * - 坦克（role='坦克'）守在基地前方，不主动追击
 * - 近战（projectileSpeed=0）主动追击敌人
 * - 射手横向移动对准敌人
 * - 治疗（role='治疗'）保持后排，远程弱攻击 + 超能治疗
 */
import { Game, LAYOUT } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR, UNLOCK_COST, getUnlockableHeroes } from '../data/heroes.js';
import { distance, uid, randomRange, clamp, pickN } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { Buffs } from './buffs.js';
import { Supers } from './hero-supers.js';

export const Heroes = {
  /** 招募英雄（必须已解锁） */
  recruit(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return false;
    if (!this.isUnlocked(heroId)) return false;
    if (Game.state.tickets < (data.cost.tickets || 1)) return false;
    Game.state.tickets -= data.cost.tickets || 1;
    Game.entities.heroes.push(this._create(data));
    return true;
  },

  /** 检查英雄是否已解锁 */
  isUnlocked(heroId) {
    return Game.state.unlockedHeroes.includes(heroId);
  },

  /** 解锁英雄（消耗英雄券） */
  unlock(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data || data.rarity === 'starter' || data.rarity === 'rare') return { ok: false, msg: '该英雄无需解锁' };
    if (this.isUnlocked(heroId)) return { ok: false, msg: '已解锁' };
    const cost = UNLOCK_COST[data.rarity];
    if (Game.state.tickets < cost) return { ok: false, msg: '英雄券不足' };
    Game.state.tickets -= cost;
    Game.state.unlockedHeroes.push(heroId);
    Game.state.unlockChoices = [];
    return { ok: true, hero: data };
  },

  /**
   * 生成解锁候选池（3 选 1）
   * 池构成规则（史诗 5 / 神话 2 / 传奇 1）：
   *   - 已解锁 0-2 史诗：池 = 3 史诗
   *   - 已解锁 3 史诗：池 = 2 史诗 + 1 神话
   *   - 已解锁 4 史诗：池 = 1 史诗 + 2 神话
   *   - 已解锁 5 史诗 + 0 神话：池 = 2 神话 + 1 传奇
   *   - 已解锁 5 史诗 + 1 神话：池 = 1 神话 + 1 传奇
   */
  generateUnlockChoices() {
    const unlocked = Game.state.unlockedHeroes;
    const remaining = getUnlockableHeroes().filter(h => !unlocked.includes(h.id));
    if (remaining.length === 0) return [];

    const unlockedEpics = getUnlockableHeroes().filter(h => h.rarity === 'epic' && unlocked.includes(h.id)).length;
    const unlockedMythics = getUnlockableHeroes().filter(h => h.rarity === 'mythic' && unlocked.includes(h.id)).length;
    const epicLeft = remaining.filter(h => h.rarity === 'epic');
    const mythicLeft = remaining.filter(h => h.rarity === 'mythic');
    const legendaryLeft = remaining.filter(h => h.rarity === 'legendary');
    const targetSize = Math.min(3, remaining.length);

    // 史诗槽位：前 3 次全史诗，之后递减
    let epicSlots = Math.max(0, 3 - Math.max(0, unlockedEpics - 2));
    epicSlots = Math.min(epicSlots, epicLeft.length);
    // 神话槽位：需已解锁 ≥3 史诗
    let mythicSlots = (unlockedEpics >= 3) ? Math.min(targetSize - epicSlots, mythicLeft.length) : 0;
    // 传奇槽位：需史诗全解锁且已解锁 ≥1 神话
    let legendarySlots = (unlockedEpics >= 5 && unlockedMythics >= 1) ? Math.min(targetSize - epicSlots - mythicSlots, legendaryLeft.length) : 0;
    // 填补空位
    let leftover = targetSize - epicSlots - mythicSlots - legendarySlots;
    if (leftover > 0 && epicLeft.length > epicSlots) { epicSlots = Math.min(epicLeft.length, epicSlots + leftover); leftover = targetSize - epicSlots - mythicSlots - legendarySlots; }
    if (leftover > 0 && mythicLeft.length > mythicSlots) { mythicSlots = Math.min(mythicLeft.length, mythicSlots + leftover); }

    const pool = [...pickN(epicLeft, epicSlots), ...pickN(mythicLeft, mythicSlots), ...pickN(legendaryLeft, legendarySlots)];
    Game.state.unlockChoices = pool;
    return pool;
  },

  recruitStarter(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return false;
    Game.entities.heroes.push(this._create(data));
    Game.state.selectedHero = heroId;
    return true;
  },

  _create(data) {
    const star = Game.state.heroStars[data.id] || 1;
    const hero = {
      uid: uid('h'),
      id: data.id, name: data.name, role: data.role, faction: data.faction,
      star,
      x: LAYOUT.base.x + randomRange(-50, 50),
      y: LAYOUT.base.y - 80,
      baseHp: data.hp, baseAttack: data.attack,
      range: data.range, attackSpeed: data.attackSpeed,
      moveSpeed: data.moveSpeed, projectileSpeed: data.projectileSpeed,
      color: data.color, accent: data.accent,
      radius: 16,
      superDef: data.super,
      bounce: data.bounce || null,
      superCharge: 0, atkCd: 0,
      hp: data.hp, maxHp: data.hp, attack: data.attack,
      superFlash: 0
    };
    this._applyStar(hero);
    return hero;
  },

  upgradeStar(heroId) {
    const curStar = Game.state.heroStars[heroId] || 1;
    if (curStar >= 5) return false;
    const cost = STAR_UPGRADE_COST[curStar - 1];
    if (Game.state.gold < cost) return false;
    Game.state.gold -= cost;
    Game.state.heroStars[heroId] = curStar + 1;
    Game.entities.heroes.forEach(h => {
      if (h.id === heroId) { h.star = curStar + 1; this._applyStar(h); }
    });
    return true;
  },

  getStar(heroId) { return Game.state.heroStars[heroId] || 1; },

  _applyStar(hero) {
    const hpRate = Buffs.heroHpRate();
    const atkRate = Buffs.heroAtkRate();
    const aspdRate = Buffs.heroAspdRate();
    hero.maxHp = Math.floor(hero.baseHp * Math.pow(STAR_GROWTH.hp, hero.star - 1) * (1 + hpRate));
    hero.attack = Math.floor(hero.baseAttack * Math.pow(STAR_GROWTH.attack, hero.star - 1) * (1 + atkRate));
    hero.effectiveAspd = hero.attackSpeed * (1 + aspdRate);
    hero.hp = hero.maxHp;
  },

  update(dt) {
    const heroes = Game.entities.heroes;
    for (let i = heroes.length - 1; i >= 0; i--) {
      const h = heroes[i];
      this._ai(h, dt);
      if (h.superFlash > 0) h.superFlash = Math.max(0, h.superFlash - dt);
      if (h.hp <= 0) {
        for (let k = 0; k < 10; k++) {
          Game.spawnParticle({
            x: h.x, y: h.y,
            vx: randomRange(-80, 80), vy: randomRange(-80, 80),
            life: 0.6, maxLife: 0.6, color: h.color, size: 3
          });
        }
        heroes.splice(i, 1);
      }
    }
    Supers.updateTurrets(dt);
    Supers.updateSummons(dt);
  },

  /** AI：所有英雄优先锁定"距离基地最近的敌人"作为移动目标
   *   - 坦克（公牛）只在后半场巡查（y >= baseLine-100），不会跑到最前方
   *   - 近战追击敌人，射手横向移动，治疗保持后排
   *   - 无敌人时所有英雄返回靠近基地（yMax 附近） */
  _ai(h, dt) {
    h.atkCd = Math.max(0, h.atkCd - dt);
    const isMelee = h.projectileSpeed === 0;
    const isTank = h.role === '坦克';
    const isSupport = h.role === '治疗';
    const target = this._findEnemy(h);
    if (target && h.atkCd <= 0) {
      this._attack(h, target);
      h.atkCd = 1 / h.effectiveAspd;
    }
    // 所有英雄优先锁定"距离基地最近的敌人"作为移动目标
    // 坦克只在后半场巡查（y >= baseLine-100），找不到就回基地
    const baseAttacker = isTank ? this._findBaseThreat() : this._findBaseAttacker();
    let moveTarget;
    if (isTank) {
      moveTarget = baseAttacker; // 公牛只用后半场威胁者作为目标，否则原地守基地
    } else {
      moveTarget = baseAttacker || target || this._nearestEnemy(h);
    }
    if (moveTarget) {
      const dx = moveTarget.x - h.x;
      if (Math.abs(dx) > 4) h.x += Math.sign(dx) * h.moveSpeed * dt * (isTank ? 0.6 : 1);
      if (isTank) {
        // 坦克朝目标缓慢推进（活动范围与普通英雄一致，可达红色边界）
        const dy = moveTarget.y - h.y;
        if (Math.abs(dy) > 10) h.y += Math.sign(dy) * h.moveSpeed * dt * 0.55;
      } else if (isMelee) {
        const dy = moveTarget.y - h.y;
        if (dy < -10 && h.y > LAYOUT.heroZone.yMin) h.y -= h.moveSpeed * dt * 0.8;
        else if (dy > 10 && h.y < LAYOUT.heroZone.yMax) h.y += h.moveSpeed * dt * 0.5;
      } else if (isSupport) {
        // 治疗保持后排（靠近基地），缓慢横向移动对准敌人
        const backY = LAYOUT.heroZone.yMax - 20;
        if (Math.abs(h.y - backY) > 10) h.y += Math.sign(backY - h.y) * h.moveSpeed * dt * 0.3;
      } else if (h.y > LAYOUT.heroZone.yMin) {
        h.y -= h.moveSpeed * dt * 0.4;
      }
    } else {
      // 没有敌人：所有非治疗英雄返回靠近基地（yMax 附近），坦克回到守基地位置
      const restY = isTank ? (LAYOUT.base.y - 80) : (LAYOUT.heroZone.yMax - 30);
      if (!isSupport && Math.abs(h.y - restY) > 8) {
        h.y += Math.sign(restY - h.y) * h.moveSpeed * dt * 0.5;
      }
    }
    h.x = clamp(h.x, 24, VIEW_W - 24);
    h.y = clamp(h.y, LAYOUT.heroZone.yMin, LAYOUT.heroZone.yMax);
    if (h.superCharge >= 1 && h.star >= SUPER_UNLOCK_STAR) {
      Supers.release(h);
      h.superCharge = 0;
    } else if (h.superCharge >= 1) {
      h.superCharge = 1;
    }
  },

  _findEnemy(h) {
    let best = null, bestDist = h.range + h.radius + 20;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  /** 查找距离基地最近的敌人（全图），用于所有英雄的移动目标优先级 */
  _findBaseAttacker() {
    let best = null, bestDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(LAYOUT.base, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  /** 查找后半场内（y >= baseLine-100）距离基地最近的敌人，用于坦克巡查 */
  _findBaseThreat() {
    let best = null, bestDist = Infinity;
    const threatY = LAYOUT.baseLine - 100;
    Game.entities.enemies.forEach(en => {
      if (en.y < threatY) return;
      const d = distance(LAYOUT.base, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  _nearestEnemy(h) {
    let best = null, bestDist = Infinity;
    Game.entities.enemies.forEach(en => {
      const d = distance(h, en);
      if (d < bestDist) { bestDist = d; best = en; }
    });
    return best;
  },

  _attack(h, target) {
    h.superCharge = Math.min(1, h.superCharge + h.superDef.chargePerHit * (1 + Buffs.superChargeRate()));
    // 伤害放大器光环加成
    const boost = Game.systems.facilities ? Game.systems.facilities.getDamageBoost(h) : 0;
    const damage = Math.floor(h.attack * (1 + boost));
    if (h.projectileSpeed > 0) {
      const dir = Combat.dirTo(h, target, h.projectileSpeed);
      Combat.spawnProjectile({
        x: h.x, y: h.y, vx: dir.vx, vy: dir.vy,
        damage, color: h.accent, radius: 5, life: 1.5,
        bounce: h.bounce || null
      });
    } else {
      Enemies.takeDamage(target, damage);
    }
  }
};

const VIEW_W = 480;
