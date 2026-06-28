/**
 * 游戏核心：状态机 + 主循环 + 实体容器 + 地图布局
 *
 * 设计原则：
 * - Game 为单例对象，集中管理状态与实体集合
 * - 系统逻辑由 main.js 注入（Game.systems），避免循环依赖
 * - update(dt) 调度各 system.update，render() 委托 renderer
 *
 * 状态机：hero-select → wave → buff-select → wave → ... → game-over
 *
 * 全局升星：state.heroStars[id] 记录该英雄种类的全局星级
 *   - 新招募的英雄实例 star 取 heroStars[id]（默认 1）
 *   - 升星操作修改 heroStars[id]，所有同 id 英雄实例同步更新
 * 强化进度：state.buffTarget 为当前目标击杀数，达成后推进到下一目标
 */
import { clamp } from './utils.js';
import { BUFF_TARGETS } from '../data/enemies.js';
import { getStarterHeroIds, HEROES } from '../data/heroes.js';

/** 逻辑画布尺寸（渲染时按容器缩放） */
export const VIEW = { w: 480, h: 720 };

/** 地图布局（纵向固定） */
export const LAYOUT = {
  spawn: { x: 240, y: 30, w: 440, h: 60 },       // 敌人刷新区
  battle: { x: 0, y: 80, w: 480, h: 360 },        // 战斗区域
  baseLine: 580,                                  // 基地前线（敌人抵达此线攻击基地）
  base: { x: 240, y: 600, w: 220, h: 70 },        // 主基地（上移+减高避免被卡牌遮挡）
  vault: { x: 240, y: 550 },                      // A 主题季宝库
  starRoad: { x: 240, y: 470 },                   // B 星妙之路
  facilitySlots: [{ x: 110, y: 470 }, { x: 370, y: 470 }], // C 建造位
  heroZone: { yMin: 80, yMax: 560 }               // 英雄活动 y 范围（最远可到红色边界 y=80）
};

/** 基地初始生命（×3 提升，配合高稀有度英雄与高血量设施） */
const BASE_MAX_HP = 15000;

export const Game = {
  state: null,
  entities: null,
  systems: {},
  renderer: null,
  _raf: 0,
  _lastTs: 0,
  _running: false,

  /** 初始化新局（开始/重开） */
  init() {
    this.state = {
      phase: 'hero-select',   // hero-select | wave | buff-select | game-over
      wave: 0,
      gold: 100,
      tickets: 100,           // 起始 100 券（招募一次刚好够）
      baseHp: BASE_MAX_HP,
      baseMaxHp: BASE_MAX_HP,
      kills: 0,
      bossKills: 0,
      killCounter: 0,         // 累计击杀
      buffTarget: BUFF_TARGETS[0],  // 当前强化目标（40 起步，达成后递增）
      buffTargetIdx: 0,       // 当前目标在 BUFF_TARGETS 中的索引
      buffPending: false,
      heroStars: {},          // 全局星级映射 { heroId: starLevel }
      autoMerge: {},          // 每英雄自动合并开关 { heroId: boolean }（宝库 7 级解锁）
      totalGoldEarned: 0,     // 累计获取金币（含已消耗，用于分数结算）
      totalTicketsEarned: 0,  // 累计获取英雄券（含已消耗）
      totalRecruited: {},     // 累计招募次数 { heroId: count }
      totalMerged: {},        // 累计合并次数 { heroId: { s6: n, s7: n } }
      paused: false,
      speedMultiplier: 1,     // 游戏速度倍率（0.5 / 1 / 2 / 4）
      heroChoices: [],        // 起始 3 选 1
      unlockedHeroes: getStarterHeroIds(),  // 已解锁英雄（开局含初始+稀有）
      unlockChoices: [],      // 当前解锁候选池（3 选 1）
      selectedHero: null,
      finalScore: 0
    };
    this.entities = {
      heroes: [],
      enemies: [],
      projectiles: [],
      particles: [],
      turrets: [],            // 杰西超级技能召唤的炮台
      summons: [],            // 塔拉超级技能召唤的友方单位
      fireZones: []           // 博尔特超能留下的燃烧区域
    };
    this.buildings = {
      vault: { level: 1, goldAcc: 0 },
      starRoad: {},
      facilities: [null, null], // 2 个 C 建造位
      facilityTier: 0          // 全局炮塔回收等级（每次回收 +1，影响后续建造价格/属性）
    };
    this.buffs = [];          // 已激活强化
    this._running = false;
  },

  /** 注入系统（由 main.js 调用） */
  use(systems) {
    this.systems = { ...this.systems, ...systems };
  },

  /** 绑定渲染器 */
  bindRenderer(renderer) {
    this.renderer = renderer;
  },

  /** 启动主循环 */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTs = performance.now();
    const loop = (ts) => {
      if (!this._running) return;
      const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
      this._lastTs = ts;
      if (!this.state.paused) this.update(dt * (this.state.speedMultiplier || 1));
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  },

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  },

  /** 每帧更新：按状态机调度各系统 */
  update(dt) {
    const s = this.systems;
    switch (this.state.phase) {
      case 'wave':
        s.wave.update(dt);
        s.heroes.update(dt);
        s.enemies.update(dt);
        s.combat.update(dt);
        s.economy.update(dt);
        s.buildings.update(dt);
        s.facilities.update(dt);
        s.merging.updateAutoMerge(dt);
        this._updateParticles(dt);
        this._checkPhaseTrans();
        break;
      case 'buff-select':
      case 'hero-select':
      case 'game-over':
        // 待 UI 操作，仅更新粒子
        this._updateParticles(dt);
        break;
    }
  },

  /** 阶段转换检查 */
  _checkPhaseTrans() {
    // 1. 强化触发：击杀累计达当前 buffTarget 立即触发（暂停游戏，弹出三选一）
    if (this.state.phase === 'wave' &&
        this.state.killCounter >= this.state.buffTarget && !this.state.buffPending) {
      this.state.buffPending = true;
      this.state.phase = 'buff-select';
      this.systems.buffs.open();
      return;
    }
    // 2. 波次清空且无敌人 → 进入下一波
    if (this.state.phase === 'wave' &&
        this.systems.wave.isCleared() && this.entities.enemies.length === 0) {
      this.systems.wave.next();
    }
    // 3. 基地被毁
    if (this.state.baseHp <= 0) {
      this.state.baseHp = 0;
      this._gameOver();
    }
  },

  /** 强化选择完成后调用：推进下一目标，恢复 wave 阶段 */
  advanceBuffTarget() {
    const next = this.state.buffTargetIdx + 1;
    if (next < BUFF_TARGETS.length) {
      this.state.buffTargetIdx = next;
      this.state.buffTarget = BUFF_TARGETS[next];
    } else {
      // 超过预定义目标后，每次 +40
      this.state.buffTarget += 40;
    }
    this.state.buffPending = false;
  },

  _updateParticles(dt) {
    const ps = this.entities.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      if (p.life <= 0) ps.splice(i, 1);
    }
  },

  render() {
    if (this.renderer) this.renderer.draw();
  },

  /** 生成粒子 */
  spawnParticle(p) {
    this.entities.particles.push(p);
  },

  /** 添加投射物 */
  addProjectile(p) {
    this.entities.projectiles.push(p);
  },

  /** 计算 Score（纯加和公式，详见 scoreBreakdown） */
  calcScore() {
    return this.scoreBreakdown().total;
  },

  /** 分数明细（全部加和，无倍率）：
   *  波数×100 + 击杀×2 + Boss×300 + 累计金币×0.2 + 累计英雄券×0.5
   *  + 已解锁英雄星级和×200 + 累计招募(基础/传奇×15 史诗神话×10)
   *  + 累计合并(6★基础传奇×30/史诗神话×20, 7★基础传奇×100/史诗神话×80) */
  scoreBreakdown() {
    const st = this.state;
    const waveScore = st.wave * 100;
    const killScore = st.kills * 2;
    const bossScore = st.bossKills * 300;
    const goldScore = Math.floor((st.totalGoldEarned || 0) * 0.2);
    const ticketScore = Math.floor((st.totalTicketsEarned || 0) * 0.5);
    // 英雄星级：已解锁英雄的当前星级（默认1）× 200
    let starScore = 0;
    st.unlockedHeroes.forEach(id => { starScore += (st.heroStars[id] || 1) * 200; });
    // 累计招募：基础(初始+稀有)/传奇 ×15，史诗/神话 ×10
    let recruitScore = 0;
    const rec = st.totalRecruited || {};
    Object.entries(rec).forEach(([id, n]) => {
      const h = HEROES.find(x => x.id === id);
      if (!h) return;
      const isEpicMythic = h.rarity === 'epic' || h.rarity === 'mythic';
      recruitScore += n * (isEpicMythic ? 10 : 15);
    });
    // 累计合并：6★基础/传奇×30 史诗神话×20；7★基础/传奇×100 史诗神话×80
    let mergeScore = 0;
    const mg = st.totalMerged || {};
    Object.entries(mg).forEach(([id, c]) => {
      const h = HEROES.find(x => x.id === id);
      if (!h) return;
      const isEpicMythic = h.rarity === 'epic' || h.rarity === 'mythic';
      mergeScore += (c.s6 || 0) * (isEpicMythic ? 20 : 30);
      mergeScore += (c.s7 || 0) * (isEpicMythic ? 80 : 100);
    });
    const total = waveScore + killScore + bossScore + goldScore + ticketScore + starScore + recruitScore + mergeScore;
    return { waveScore, killScore, bossScore, goldScore, ticketScore, starScore, recruitScore, mergeScore, total };
  },

  _gameOver() {
    this.state.phase = 'game-over';
    this.state.finalScore = this.calcScore();
    if (this.systems.ui && this.systems.ui.onGameOver) {
      this.systems.ui.onGameOver();
    }
  },

  /** 受伤基地 */
  damageBase(dmg) {
    this.state.baseHp = clamp(this.state.baseHp - dmg, 0, this.state.baseMaxHp);
  },

  /** 治疗基地 */
  healBase(hp) {
    this.state.baseHp = clamp(this.state.baseHp + hp, 0, this.state.baseMaxHp);
  }
};
