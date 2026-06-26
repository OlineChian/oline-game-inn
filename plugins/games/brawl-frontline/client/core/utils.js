/**
 * 核心工具函数（数学、碰撞、随机）
 * 纯函数模块，无状态，无副作用
 */

/** 两点距离 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 从 a 指向 b 的角度（弧度） */
export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** 数值钳制 */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** 线性插值 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 圆形碰撞检测（实体需有 x,y,radius） */
export function circleHit(a, b) {
  const r = a.radius + b.radius;
  return distance(a, b) <= r;
}

/** 点是否在圆内 */
export function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** 角度差（考虑环形） */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 区间随机浮点 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/** 数组随机取一 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 从数组随机取 n 个不重复 */
export function pickN(arr, n) {
  const pool = [...arr];
  const result = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/** 生成唯一 id */
let _idCounter = 0;
export function uid(prefix = 'e') {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

/** 格式化数字（千分位） */
export function fmtNum(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
