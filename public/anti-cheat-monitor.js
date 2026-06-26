/**
 * 反作弊监测器（客户端公共模块）
 *
 * 设计目标：
 *   1. 阈值配置驱动：每个游戏在 script.js 声明阈值，监测器通用
 *   2. 实时检测：游戏循环中调用 monitor.check(snapshot)
 *   3. 弹窗预警：检测到异常时弹窗阻止提交
 *   4. 状态快照：生成 antiCheat 对象供服务端二次校验
 *
 * 用法：
 *   const monitor = AntiCheatMonitor.create('buster-montage', {
 *     score:        { max: 1850 },
 *     playedMs:     { min: 3000 },
 *     inputCount:   { min: 3 },
 *     maxNoInputMs: { max: 15000 }
 *   });
 *   const result = monitor.check({ score, playedMs, inputCount, maxNoInputMs });
 *   if (!result.ok) { monitor.alert(result.violations.join('\n')); return; }
 *
 * 依赖：无（纯 vanilla JS，CSS 变量降级）
 */
(function (global) {
  'use strict';

  // 弹窗 DOM 复用（避免重复创建）
  let modalEl = null;
  let styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.id = 'acm-alert-style';
    // 使用 CSS 变量降级（theme 未加载时用 fallback）
    style.textContent = `
.acm-alert{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999;animation:acm-fade .2s ease}
.acm-alert-box{background:var(--bg-surface,#fff);color:var(--text-primary,#333);padding:24px;border-radius:12px;max-width:90vw;width:380px;box-shadow:0 8px 32px rgba(0,0,0,.3);text-align:center;font-family:system-ui,-apple-system,sans-serif}
.acm-alert-title{font-size:20px;font-weight:bold;color:var(--color-danger,#d32f2f);margin-bottom:8px}
.acm-alert-game{font-size:13px;color:var(--text-secondary,#888);margin-bottom:16px}
.acm-alert-msg{font-size:14px;color:var(--text-primary,#333);line-height:1.6;margin-bottom:20px;white-space:pre-wrap;word-break:break-word}
.acm-alert-btn{padding:8px 32px;background:var(--color-danger,#d32f2f);color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:opacity .15s}
.acm-alert-btn:hover{opacity:.85}
@keyframes acm-fade{from{opacity:0}to{opacity:1}}
`;
    document.head.appendChild(style);
    styleInjected = true;
  }

  function showModal(gameId, message) {
    injectStyle();
    if (modalEl) modalEl.remove();
    modalEl = document.createElement('div');
    modalEl.className = 'acm-alert';
    const gameLabel = gameId ? `游戏：${gameId}` : '';
    modalEl.innerHTML =
      '<div class="acm-alert-box">' +
      '<div class="acm-alert-title">⚠️ 检测到异常</div>' +
      '<div class="acm-alert-game">' + gameLabel + '</div>' +
      '<div class="acm-alert-msg">' + message + '</div>' +
      '<button class="acm-alert-btn" type="button">知道了</button>' +
      '</div>';
    document.body.appendChild(modalEl);
    modalEl.querySelector('.acm-alert-btn').onclick = function () {
      modalEl.remove();
      modalEl = null;
    };
  }

  /**
   * 创建监测器实例
   * @param {string} gameId - 游戏标识（如 'buster-montage'）
   * @param {object} config - 阈值配置，key 为指标名，value 含 min/max
   * @returns {object} monitor 实例
   */
  function create(gameId, config) {
    // 内部状态：是否已弹窗（防刷屏），最后一次检查结果
    let alerted = false;
    let lastResult = null;

    return {
      gameId: gameId,
      config: config || {},

      /**
       * 检查快照是否在阈值内
       * @param {object} snapshot - { metric: value, ... }
       * @returns {{ok:boolean, violations:string[]}}
       */
      check: function (snapshot) {
        const violations = [];
        for (const metric in config) {
          if (!Object.prototype.hasOwnProperty.call(config, metric)) continue;
          const v = snapshot[metric];
          if (v === undefined || v === null) continue; // 未提供该指标，跳过
          const num = Number(v);
          if (!Number.isFinite(num)) {
            violations.push(metric + ' 字段非数值');
            continue;
          }
          const limits = config[metric];
          if (limits.min !== undefined && num < limits.min) {
            violations.push(metric + '=' + num + ' 低于下限 ' + limits.min);
          }
          if (limits.max !== undefined && num > limits.max) {
            violations.push(metric + '=' + num + ' 超过上限 ' + limits.max);
          }
        }
        lastResult = { ok: violations.length === 0, violations: violations };
        return lastResult;
      },

      /**
       * 弹窗提醒（同一次 alert 只弹一次，避免游戏循环中刷屏）
       * @param {string} message
       */
      alert: function (message) {
        if (alerted) return;
        alerted = true;
        const full = message || (lastResult && lastResult.violations.join('\n')) || '检测到异常游戏状态';
        showModal(gameId, full);
      },

      /** 重置已弹窗标记（新一局游戏开始时调用） */
      reset: function () {
        alerted = false;
        lastResult = null;
      },

      /** 是否已弹窗 */
      hasAlerted: function () { return alerted; }
    };
  }

  global.AntiCheatMonitor = { create: create };
})(window);
