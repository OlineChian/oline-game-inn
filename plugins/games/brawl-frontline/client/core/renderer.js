/**
 * Canvas 渲染器
 * 逻辑坐标（VIEW 480×720）→ 屏幕坐标（按容器缩放，保持比例）
 * 绘制顺序：背景区域 → 建筑基地 → 实体（敌人/英雄/炮台）→ 投射物 → 粒子
 */
import { Game, VIEW, LAYOUT } from './game.js';

export const Renderer = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const c = this.canvas;
    const parent = c.parentElement;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;
    const scaleW = maxW / VIEW.w;
    const scaleH = maxH / VIEW.h;
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
    this._drawBackground();
    this._drawBase();
    this._drawBuildings();
    this._drawEntities();
    this._drawProjectiles();
    this._drawParticles();
  },

  _drawBackground() {
    const ctx = this.ctx;
    // 敌人刷新区
    ctx.fillStyle = 'rgba(255,107,107,0.08)';
    ctx.fillRect(0, 0, VIEW.w, 80);
    // 战斗区域
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 80, VIEW.w, 360);
    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 80); ctx.lineTo(VIEW.w, 80);
    ctx.moveTo(0, 440); ctx.lineTo(VIEW.w, 440);
    ctx.moveTo(0, LAYOUT.baseLine); ctx.lineTo(VIEW.w, LAYOUT.baseLine);
    ctx.stroke();
    // 路径引导线
    ctx.strokeStyle = 'rgba(248,201,63,0.15)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(LAYOUT.spawn.x, 60);
    ctx.lineTo(LAYOUT.spawn.x, LAYOUT.baseLine);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  _drawBase() {
    const ctx = this.ctx;
    const b = LAYOUT.base;
    const st = Game.state;
    ctx.fillStyle = 'rgba(237,117,38,0.85)';
    this._roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏠 主基地', b.x, b.y - 6);
    // 血条
    this._drawBar(b.x - b.w / 2 + 10, b.y + 10, b.w - 20, 8,
      st.baseHp / st.baseMaxHp, '#06d6a0', '#ff6b6b');
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${Math.floor(st.baseHp)}/${st.baseMaxHp}`, b.x, b.y + 34);
  },

  _drawBuildings() {
    const ctx = this.ctx;
    // A 主题季宝库
    const v = LAYOUT.vault;
    ctx.fillStyle = 'rgba(244,162,97,0.9)';
    this._circle(v.x, v.y, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`A Lv${Game.buildings.vault.level}`, v.x, v.y + 4);
    // B 星妙之路
    const sr = LAYOUT.starRoad;
    ctx.fillStyle = 'rgba(58,134,255,0.9)';
    this._circle(sr.x, sr.y, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText('B', sr.x, sr.y + 4);
    // C 建造位（Phase 2）
    LAYOUT.facilitySlots.forEach((slot, i) => {
      const f = Game.buildings.facilities[i];
      if (f) {
        ctx.fillStyle = f.color || 'rgba(155,93,229,0.9)';
        this._circle(slot.x, slot.y, 20);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  },

  _drawEntities() {
    const e = Game.entities;
    // 敌人
    e.enemies.forEach(en => this._drawUnit(en, false));
    // 英雄
    e.heroes.forEach(h => this._drawUnit(h, true));
    // 炮台（召唤物）
    e.turrets.forEach(t => this._drawTurret(t));
  },

  _drawUnit(u, isHero) {
    const ctx = this.ctx;
    // 阴影（卡通落地阴影）
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.radius * 0.85, u.radius * 0.95, u.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isHero) {
      // 英雄：圆角矩形主体 + 粗白描边 + 超能释放高亮
      const w = u.radius * 2.4, h = u.radius * 1.8;
      const rx = u.x - w / 2, ry = u.y - h / 2;
      // 超能释放高亮（光晕）
      if (u.superFlash > 0) {
        ctx.shadowColor = u.accent || u.color;
        ctx.shadowBlur = 20 * u.superFlash / 0.5;
      }
      ctx.fillStyle = u.color;
      this._roundRect(rx, ry, w, h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 描边
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 英雄名字（完整两字名，居中显示）
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.name, u.x, u.y);
      ctx.textBaseline = 'alphabetic';
    } else {
      // 敌人：圆角方形（与英雄形状区分）+ 描边
      ctx.fillStyle = u.color;
      this._roundRect(u.x - u.radius, u.y - u.radius, u.radius * 2, u.radius * 2, 5);
      ctx.fill();
      ctx.strokeStyle = u.accent || '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(u.x - u.radius * 0.3, u.y - u.radius * 0.1, 2, 0, Math.PI * 2);
      ctx.arc(u.x + u.radius * 0.3, u.y - u.radius * 0.1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 血条（带描边）
    const bw = isHero ? u.radius * 2.4 : u.radius * 2;
    const bx = u.x - bw / 2, by = u.y - (isHero ? u.radius * 0.9 + 9 : u.radius + 9), bh = 5;
    this._drawBar(bx, by, bw, bh, u.hp / u.maxHp, '#06d6a0', '#ff6b6b');
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    // 英雄星级（血条上方）
    if (isHero && u.star > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(u.star), u.x, by - 3);
    }
    // 超级技能充能条（英雄，3星解锁时金色，未解锁时灰色）
    if (isHero) {
      const chargeW = u.radius * 2.4;
      const chargeColor = u.star >= 3 ? '#F8C93F' : 'rgba(155,155,155,0.5)';
      this._drawBar(u.x - chargeW / 2, u.y + (u.radius * 0.9) + 4, chargeW, 4,
        u.superCharge, chargeColor, 'rgba(255,255,255,0.12)');
    }
  },

  _drawTurret(t) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(46,196,182,0.9)';
    this._circle(t.x, t.y, 12);
    this._drawBar(t.x - 12, t.y - 20, 24, 3, t.hp / t.maxHp, '#06d6a0', '#ff6b6b');
  },

  _drawProjectiles() {
    const ctx = this.ctx;
    Game.entities.projectiles.forEach(p => {
      ctx.fillStyle = p.color || '#ffd700';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  _drawParticles() {
    const ctx = this.ctx;
    Game.entities.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  },

  // ---- 绘制辅助 ----
  _circle(x, y, r, fill) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  },

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  _drawBar(x, y, w, h, ratio, colorGood, colorBad) {
    const ctx = this.ctx;
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = colorBad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colorGood;
    ctx.fillRect(x, y, w * ratio, h);
  }
};
