/** 英雄系统：招募/升星/AI/超能调度
 * 全局升星(state.heroStars[id])；超能3星解锁满能自动释放(hero-supers.js)
 * 坦克守基地/近战追击/射手横向/治疗后排 */
import { Game, LAYOUT } from '../core/game.js';
import { HEROES, STAR_UPGRADE_COST, STAR_GROWTH, SUPER_UNLOCK_STAR, UNLOCK_COST, getUnlockableHeroes } from '../data/heroes.js';
import { distance, uid, randomRange, clamp, pickN } from '../core/utils.js';
import { Combat } from './combat.js';
import { Enemies } from './enemies.js';
import { Buffs } from './buffs.js';
import { Supers } from './hero-supers.js';
import { BoltAI } from './hero-bolt.js';

export const Heroes = {
  /** 招募英雄（必须已解锁） */
  recruit(heroId) {
    const data = HEROES.find(h => h.id === heroId);
    if (!data) return false;
    if (!this.isUnlocked(heroId)) return false;
    if (Game.state.tickets < (data.cost.tickets || 1)) return false;
    Game.state.tickets -= data.cost.tickets || 1;
    Game.entities.heroes.push(this._create(data));
    Game.state.totalRecruited[heroId] = (Game.state.totalRecruited[heroId] || 0) + 1;
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
    Game.state.totalRecruited[heroId] = (Game.state.totalRecruited[heroId] || 0) + 1;
    return true;
  },

  _create(data) {
    const star = Game.state.heroStars[data.id] || 1;
    const hero = {
      uid: uid('h'),
      id: data.id, name: data.name, role: data.role, faction: data.faction,
      rarity: data.rarity, star,
      x: LAYOUT.base.x + randomRange(-50, 50),
      y: LAYOUT.base.y - 80,
      baseHp: data.hp, baseAttack: data.attack,
      range: data.range, attackSpeed: data.attackSpeed,
      moveSpeed: data.moveSpeed, projectileSpeed: data.projectileSpeed,
      color: data.color, accent: data.accent,
      radius: 16,
      superDef: data.super,
      bounce: data.bounce || null,
      percentDamage: data.percentDamage || null,
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
    // 1-5 星用 STAR_GROWTH 乘算；6/7 星叠加合并倍率（5★×2.5/6★×3.0 血伤，1.5/2.0 攻速）
    let hpMult = Math.pow(STAR_GROWTH.hp, Math.min(hero.star, 5) - 1);
    let atkMult = Math.pow(STAR_GROWTH.attack, Math.min(hero.star, 5) - 1);
    let aspdMult = 1;
    if (hero.star >= 7) { hpMult *= 2.5 * 3.0; atkMult *= 2.5 * 3.0; aspdMult = 1.5 * 2.0; }
    else if (hero.star === 6) { hpMult *= 2.5; atkMult *= 2.5; aspdMult = 1.5; }
    hero.maxHp = Math.floor(hero.baseHp * hpMult * (1 + hpRate));
    hero.attack = Math.floor(hero.baseAttack * atkMult * (1 + atkRate));
    hero.effectiveAspd = hero.attackSpeed * aspdMult * (1 + aspdRate);
    hero.hp = hero.maxHp;
  },

  update(dt) {
    const heroes = Game.entities.heroes;
    for (let i = heroes.length - 1; i >= 0; i--) {
      const h = heroes[i];
      if (h._targetTimer > 0) h._targetTimer -= dt;   // 衰减目标锁定计时（跨帧分散火力）
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
    Combat.separateHeroes();
    Supers.updateTurrets(dt);
    Supers.updateSummons(dt);
    BoltAI.updateFireZones(dt);
  },

  /** AI：所有英雄优先锁定"距离基地最近的敌人"作为移动目标
   *   - 坦克（公牛）只在后半场巡查（y >= baseLine-100），不会跑到最前方
   *   - 近战追击敌人，射手横向移动，治疗保持后排
   *   - 无敌人时所有英雄返回靠近基地（yMax 附近） */
  _ai(h, dt) {
    h.atkCd = Math.max(0, h.atkCd - dt);
    // 博尔特：椭圆巡逻 AI，不走常规目标选择与移动逻辑
    if (h.id === 'bolt') {
      BoltAI.update(h, dt);
      this._checkSuper(h);
      return;
    }
    const isMelee = h.projectileSpeed === 0;
    const isTank = h.role === '坦克';
    const isSupport = h.role === '治疗';
    // 仅在能攻击时选目标并占用锁定名额（atkCd > 0 时不锁敌，避免浪费分散火力配额）
    let target = null;
    if (h.atkCd <= 0) {
      target = this._findEnemy(h);
      if (target) {
        Combat.heroAttack(h, target);
        h.atkCd = 1 / h.effectiveAspd;
        h._targetUid = target.uid;            // 记录锁定目标，持续 1 个攻击周期
        h._targetTimer = 1 / h.effectiveAspd;
      }
    }
    // 所有英雄优先锁定"距离基地最近的敌人"作为移动目标
    // 坦克只在后半场巡查（y >= baseLine-100），找不到就回基地
    const baseAttacker = this._findNearestToBase(isTank);
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
      } else {
        // 射手：纵向跟随目标位置，目标在前方则前进、在后方则回防
        const dy = moveTarget.y - h.y;
        if (dy < -10 && h.y > LAYOUT.heroZone.yMin) {
          h.y += Math.sign(dy) * h.moveSpeed * dt * 0.5;   // 目标在前方，前进接近
        } else if (dy > 10 && h.y < LAYOUT.heroZone.yMax) {
          h.y += Math.sign(dy) * h.moveSpeed * dt * 0.5;   // 目标在后方（靠近基地），回防
        }
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
    this._checkSuper(h);
  },

  /** 超能充能满后自动释放（3 星及以上解锁） */
  _checkSuper(h) {
    if (h.superCharge >= 1 && h.star >= SUPER_UNLOCK_STAR) {
      Supers.release(h);
      h.superCharge = 0;
    } else if (h.superCharge >= 1) {
      h.superCharge = 1;
    }
  },

  /** 查找射程内最近敌人，遵循"分散火力"规则：
   *  - 同一敌人最多被 3 个英雄锁定，第 4 个改选第二近的（跨帧跟踪，_targetTimer>0 视为锁定中）
   *  - 大型/高血量敌人（isBoss 或 maxHp≥2500）不受限制，可继续集火
   *  - 距离相近（容差 10）时优先 x 距离更近的，避免左右两边都有时总打一边 */
  _findEnemy(h) {
    const reach = h.range + h.radius + 20;
    const list = [];
    for (const en of Game.entities.enemies) {
      const d = distance(h, en);
      if (d < reach) list.push({ en, d, xD: Math.abs(h.x - en.x) });
    }
    if (!list.length) return null;
    list.sort((a, b) => Math.abs(a.d - b.d) <= 10 ? a.xD - b.xD : a.d - b.d);
    for (const item of list) {
      const large = item.en.isBoss || item.en.maxHp >= 2500;
      if (large || Combat.lockCountOf(item.en.uid) < 3) return item.en;
    }
    return list[0].en;
  },

  /** 通用：在敌人列表中找最近者，距离相近（容差 10）时优先 x 距离更近的，避免左右偏向 */
  _nearestOf(ref, refX, arr) {
    let best = null, bestDist = Infinity, bestXDist = Infinity;
    for (const en of arr) {
      const d = distance(ref, en);
      const xD = Math.abs(refX - en.x);
      if (Math.abs(d - bestDist) <= 10) {
        if (xD < bestXDist) { bestDist = d; bestXDist = xD; best = en; }
      } else if (d < bestDist) {
        bestDist = d; bestXDist = xD; best = en;
      }
    }
    return best;
  },

  /** 距离基地最近敌人；threatOnly=true 时只看后半场（坦克巡查用） */
  _findNearestToBase(threatOnly) {
    const arr = threatOnly
      ? Game.entities.enemies.filter(en => en.y >= LAYOUT.baseLine - 100)
      : Game.entities.enemies;
    return this._nearestOf(LAYOUT.base, LAYOUT.base.x, arr);
  },

  _nearestEnemy(h) {
    return this._nearestOf(h, h.x, Game.entities.enemies);
  }
};

const VIEW_W = 480;
