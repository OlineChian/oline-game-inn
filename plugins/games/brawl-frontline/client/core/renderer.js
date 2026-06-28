/**
 * Canvas 渲染器（Code-Only Comic UI）
 * 逻辑坐标（VIEW 480×720）→ 屏幕坐标（按容器缩放，保持比例）
 *
 * 设计语言：
 * - 地图：Grass #8DDC65 / Road #CFA16A / Water #5BC0EB / Wall #777
 * - 敌人几何：●普通 / ◆快速 / ■坦克 / ⬢Boss
 * - 血条 8px：灰底 + 绿血 + 蓝护盾 + 紫 Boss
 * - 描边 3px solid #222 + Supercell 阴影 0 5px 0 #222
 */
import { Game, VIEW, LAYOUT } from './game.js';
import {
  COLOR, BW, FONT,
  drawShape, strokeShape, roundRect,
  drawBar, drawShieldBar, drawChargeBar, drawShadow
} from './shapes.js';

export const Renderer = {
  canvas: null,
  ctx: null,
  scale: 1,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const c = this.canvas;
    const parent = c.parentElement;
    const scaleW = parent.clientWidth / VIEW.w;
    const scaleH = parent.clientHeight / VIEW.h;
    this.scale = Math.min(scaleW, scaleH);
    const dpr = window.devicePixelRatio || 1;
    c.width = VIEW.w * this.scale * dpr;
    c.height = VIEW.h * this.scale * dpr;
    c.style.width = (VIEW.w * this.scale) + 'px';
    c.style.height = (VIEW.h * this.scale) + 'px';
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    this._drawMap();
    this._drawBase();
    this._drawBuildings();
    this._drawEntities();
    this._drawProjectiles();
    this._drawParticles();
  },

  /** 地图：Grass 背景 + Road 中路 + Water 装饰 + Wall 边界 */
  _drawMap() {
    const ctx = this.ctx;
    // Grass 整张底
    ctx.fillStyle = COLOR.grass;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // Wall 边界（四边）
    ctx.fillStyle = COLOR.wall;
    ctx.fillRect(0, 0, VIEW.w, BW);
    ctx.fillRect(0, VIEW.h - BW, VIEW.w, BW);
    ctx.fillRect(0, 0, BW, VIEW.h);
    ctx.fillRect(VIEW.w - BW, 0, BW, VIEW.h);
    // Road 中路（敌人路径）
    const roadW = 80;
    const roadX = VIEW.w / 2 - roadW / 2;
    ctx.fillStyle = COLOR.road;
    ctx.fillRect(roadX, 0, roadW, LAYOUT.base.y);
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW;
    ctx.beginPath();
    ctx.moveTo(roadX, 0); ctx.lineTo(roadX, LAYOUT.base.y);
    ctx.moveTo(roadX + roadW, 0); ctx.lineTo(roadX + roadW, LAYOUT.base.y);
    ctx.stroke();
    // Water 装饰池（左右两侧）
    ctx.fillStyle = COLOR.water;
    roundRect(ctx, 20, 240, 60, 120, 16); ctx.fill();
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW; ctx.stroke();
    roundRect(ctx, VIEW.w - 80, 240, 60, 120, 16); ctx.fill();
    ctx.stroke();
    // 红色边界（英雄最远到达线）
    ctx.strokeStyle = 'rgba(255,89,94,0.6)'; ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(BW, LAYOUT.heroZone.yMin);
    ctx.lineTo(VIEW.w - BW, LAYOUT.heroZone.yMin);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  /** 基地：粗边框圆角矩形 + 血量填充 */
  _drawBase() {
    const ctx = this.ctx;
    const b = LAYOUT.base;
    const st = Game.state;
    const ratio = Math.max(0, Math.min(1, st.baseHp / st.baseMaxHp));
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    // Supercell 阴影
    ctx.fillStyle = COLOR.shadow;
    roundRect(ctx, x, y + 5, b.w, b.h, 16); ctx.fill();
    // 底色（灰）
    ctx.fillStyle = COLOR.hpBg;
    roundRect(ctx, x, y, b.w, b.h, 16); ctx.fill();
    // 血量前景（低血量红，否则绿）
    if (ratio > 0) {
      ctx.save();
      roundRect(ctx, x, y, b.w, b.h, 16); ctx.clip();
      ctx.fillStyle = ratio < 0.3 ? COLOR.hpBad : COLOR.hpGood;
      ctx.fillRect(x, y, b.w * ratio, b.h);
      ctx.restore();
    }
    // 粗黑描边
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW;
    roundRect(ctx, x, y, b.w, b.h, 16); ctx.stroke();
    // 标签
    ctx.fillStyle = COLOR.border;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('主基地', b.x, b.y - 14);
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`${Math.floor(st.baseHp)} / ${st.baseMaxHp}`, b.x, b.y + 6);
    ctx.textBaseline = 'alphabetic';
  },

  /** 建筑：仅绘制 C 设施建造位（宝库/星妙之路由 HUD 按钮交互，不在地图上画）
   *  booster / attacker 类型均显示攻击范围（浅色低透明度虚线） */
  _drawBuildings() {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    LAYOUT.facilitySlots.forEach((slot, i) => {
      const f = Game.buildings.facilities[i];
      if (f) {
        // 攻击范围：浅色 + 低透明度 + 虚线
        if (f.type === 'booster' || f.type === 'attacker') {
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(slot.x, slot.y, f.range, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        drawShape(ctx, slot.x, slot.y, f.radius, 'circle', f.color);
        ctx.fillStyle = COLOR.white; ctx.font = `bold ${f.radius}px ${FONT}`;
        ctx.fillText(f.name[0], slot.x, slot.y + 1);
        drawBar(ctx, slot.x - 24, slot.y - f.radius - 14, 48, f.hp / f.maxHp, false);
      } else {
        ctx.strokeStyle = 'rgba(34,34,34,0.3)'; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(slot.x, slot.y, 18, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(34,34,34,0.4)'; ctx.font = `bold 22px ${FONT}`;
        ctx.fillText('+', slot.x, slot.y + 1);
      }
    });
    ctx.textBaseline = 'alphabetic';
  },

  _drawEntities() {
    const e = Game.entities;
    e.fireZones.forEach(z => this._drawFireZone(z));   // 燃烧区域（地面效果，最先渲染）
    e.enemies.forEach(en => this._drawEnemy(en));
    e.heroes.forEach(h => this._drawHero(h));
    e.turrets.forEach(t => this._drawTurret(t));
    e.summons.forEach(s => this._drawSummon(s));
  },

  /** 敌人：按类型绘制几何形状 */
  _drawEnemy(en) {
    const ctx = this.ctx;
    const shape = this._enemyShape(en);
    const color = en.enraged ? '#FF3030' : en.color;
    drawShadow(ctx, en.x, en.y, en.radius);
    drawShape(ctx, en.x, en.y, en.radius, shape, color);
    // 盾卫减伤外圈
    if (en.damageReduction > 0) {
      ctx.strokeStyle = 'rgba(34,34,34,0.4)'; ctx.lineWidth = 2;
      strokeShape(ctx, en.x, en.y, en.radius + 4, shape);
    }
    // 护盾光环
    if (en.shieldHp > 0) {
      ctx.strokeStyle = COLOR.shield; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(en.x, en.y, en.radius + 6, 0, Math.PI * 2); ctx.stroke();
    }
    // 血条 8px（Boss 紫）
    const bw = en.radius * 2 + 6;
    drawBar(ctx, en.x - bw / 2, en.y - en.radius - 14, bw, en.hp / en.maxHp, en.isBoss);
    // 护盾条（在血条上方，蓝色）
    if (en.shieldHp > 0) {
      drawShieldBar(ctx, en.x - bw / 2, en.y - en.radius - 24, bw, Math.min(1, en.shieldHp / 800));
    }
  },

  /** 根据 enemy 数据返回几何形状类型（●普通 / ◆快速 / ■坦克 / ⬢Boss） */
  _enemyShape(en) {
    if (en.isBoss) return 'hexagon';
    if (en.ai === 'hunter') return 'diamond';     // 快射手
    if (en.id === 'heavy-bot' || en.id === 'shield-guard') return 'square'; // 坦克
    return 'circle'; // 普通机器人/爆破兵
  },

  /** 英雄：圆角矩形 + 粗黑描边 + 名字 */
  _drawHero(h) {
    const ctx = this.ctx;
    const w = h.radius * 2.4, hh = h.radius * 1.8;
    const x = h.x - w / 2, y = h.y - hh / 2;
    // Supercell 阴影
    ctx.fillStyle = COLOR.shadow;
    roundRect(ctx, x, y + 5, w, hh, 8); ctx.fill();
    // 超能释放高亮
    if (h.superFlash > 0) {
      ctx.shadowColor = h.accent || h.color;
      ctx.shadowBlur = 20 * h.superFlash / 0.5;
    }
    // 主体
    ctx.fillStyle = h.color;
    roundRect(ctx, x, y, w, hh, 8); ctx.fill();
    ctx.shadowBlur = 0;
    // 粗黑描边
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW;
    roundRect(ctx, x, y, w, hh, 8); ctx.stroke();
    // 名字
    ctx.fillStyle = COLOR.white;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(h.name, h.x, h.y);
    // 星级（金色）
    if (h.star > 1) {
      ctx.fillStyle = COLOR.gold;
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText('★'.repeat(h.star), h.x, y - 12);
    }
    // 血条 8px
    const bw = w + 4;
    drawBar(ctx, h.x - bw / 2, y - 10, bw, h.hp / h.maxHp, false);
    // 超能充能条（3 星解锁后金色，否则灰）
    const chargeColor = h.star >= 3 ? COLOR.gold : '#999999';
    drawChargeBar(ctx, h.x - bw / 2, h.y + hh / 2 + 4, bw, h.superCharge, chargeColor);
    ctx.textBaseline = 'alphabetic';
  },

  /** 炮台：SVG 化（圆形炮塔 + 矩形底座 + 粗描边 + 攻击范围） */
  _drawTurret(t) {
    const ctx = this.ctx;
    // 攻击范围：浅色 + 低透明度 + 虚线
    if (t.range) {
      ctx.strokeStyle = 'rgba(46,196,182,0.20)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#555';
    roundRect(ctx, t.x - 10, t.y + 4, 20, 8, 3); ctx.fill();
    ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW; ctx.stroke();
    drawShape(ctx, t.x, t.y - 2, 10, 'circle', '#2EC4B6');
    drawBar(ctx, t.x - 14, t.y - 22, 28, t.hp / t.maxHp, false);
  },

  /** 燃烧区域（博尔特超能）：半透明橙红圆形 + 虚线边缘 */
  _drawFireZone(z) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,107,53,0.25)';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,53,0.6)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  },

  /** 召唤物：菱形 */
  _drawSummon(s) {
    const ctx = this.ctx;
    drawShadow(ctx, s.x, s.y, s.radius);
    drawShape(ctx, s.x, s.y, s.radius, 'diamond', s.color);
    drawBar(ctx, s.x - 16, s.y - s.radius - 14, 32, s.hp / s.maxHp, false);
  },

  _drawProjectiles() {
    const ctx = this.ctx;
    Game.entities.projectiles.forEach(p => {
      ctx.fillStyle = p.color || COLOR.gold;
      ctx.strokeStyle = COLOR.border; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
  },

  _drawParticles() {
    const ctx = this.ctx;
    Game.entities.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color || COLOR.white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
};
