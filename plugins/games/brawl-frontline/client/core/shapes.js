/**
 * 几何绘制原语（Code-Only Comic UI）
 * 提供 Canvas 上的几何形状路径构建、填充描边、血条/护盾条/充能条绘制
 *
 * 设计规范：
 * - 描边 3px solid #222
 * - 血条 8px：灰底 + 绿血 + 蓝 shield + 紫 Boss
 * - 形状：circle / square / diamond / hexagon
 */

export const COLOR = {
  grass: '#8DDC65',
  road: '#CFA16A',
  water: '#5BC0EB',
  wall: '#777',
  border: '#222',
  hpBg: '#DDDDDD',
  hpGood: '#22C55E',
  hpBad: '#FF595E',
  shield: '#3B82F6',
  bossHp: '#6C5CE7',
  gold: '#FFC83D',
  shadow: 'rgba(0,0,0,0.25)',
  white: '#FFFFFF'
};

export const BW = 3;       // 统一描边宽度
export const BAR_H = 8;    // 血条统一高度
export const FONT = 'Inter, "Noto Sans SC", Arial, sans-serif';

/** 构建 shape 路径：circle / square / diamond / hexagon */
export function pathShape(ctx, x, y, r, shape) {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }
}

/** 填充指定形状（含 3px 黑描边） */
export function drawShape(ctx, x, y, r, shape, fillColor) {
  ctx.fillStyle = fillColor;
  pathShape(ctx, x, y, r, shape);
  ctx.fill();
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = BW;
  ctx.stroke();
}

/** 仅描边指定形状 */
export function strokeShape(ctx, x, y, r, shape) {
  pathShape(ctx, x, y, r, shape);
  ctx.stroke();
}

/** 圆角矩形路径 */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 血条 8px：灰底 + 绿血（Boss 紫） + 黑描边 */
export function drawBar(ctx, x, y, w, ratio, isBoss) {
  ratio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = COLOR.hpBg;
  ctx.fillRect(x, y, w, BAR_H);
  ctx.fillStyle = isBoss ? COLOR.bossHp : COLOR.hpGood;
  ctx.fillRect(x, y, w * ratio, BAR_H);
  ctx.strokeStyle = COLOR.border; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, BAR_H);
}

/** 护盾条（蓝色，4px） */
export function drawShieldBar(ctx, x, y, w, ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = 'rgba(34,34,34,0.4)';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = COLOR.shield;
  ctx.fillRect(x, y, w * ratio, 4);
}

/** 超能充能条（4px） */
export function drawChargeBar(ctx, x, y, w, ratio, color) {
  ratio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = 'rgba(34,34,34,0.2)';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * ratio, 4);
}

/** 椭圆阴影（卡通落地阴影） */
export function drawShadow(ctx, x, y, r) {
  ctx.fillStyle = COLOR.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}
