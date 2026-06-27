/**
 * 切斯特牌 - 胜利结算分数提交区块
 * 独立模块，从 render.js 拆分（保持单文件 ≤300 行铁律）
 * 阶段 7：排行榜接入（昵称输入 + HMAC 签名 + POST 请求）
 *
 * 状态机：
 *   undefined → 有昵称则「提交中」提示（等待上层触发），无昵称则显示输入框
 *   'submitting' → 提交中
 *   'success' → 提交成功
 *   'fail' → 提交失败，显示重试按钮
 * 注意：默认分支不再显示「已自动提交」，避免 fire-and-forget 吞错误时 UI 误导
 */

/**
 * 渲染胜利时的分数提交区块
 * @param {object} state - 游戏状态（读取 state.totalScore）
 * @param {object} opts - 选项 { submitState: undefined|'submitting'|'success'|'fail' }
 * @returns {string} HTML 字符串
 */
export function renderVictorySubmitSection(state, opts = {}) {
  const nickname = localStorage.getItem('gameNickname') || '';

  if (opts.submitState === 'submitting') {
    return `<div class="cc-submit-status is-loading">提交中...</div>`;
  }
  if (opts.submitState === 'success') {
    return `<div class="cc-submit-status is-success">✓ 成绩已提交到排行榜（${nickname} · ${state.totalScore} 分）</div>`;
  }
  if (opts.submitState === 'fail') {
    return `<div class="cc-submit-status is-fail">✗ 提交失败，请重试</div>
      <input id="ccNicknameInput" class="cc-input" placeholder="输入昵称" maxlength="12" value="${nickname}">
      <button class="cc-btn cc-btn-submit" data-action="submit-score">重新提交</button>`;
  }
  // 默认：有昵称也只显示「提交中」（等待上层 async 提交回写真实结果），无昵称显示输入框
  if (nickname) {
    return `<div class="cc-submit-status is-loading">正在提交（${nickname}）...</div>`;
  }
  return `<div class="cc-submit-hint">提交成绩到排行榜：</div>
    <input id="ccNicknameInput" class="cc-input" placeholder="输入昵称" maxlength="12">
    <button class="cc-btn cc-btn-submit" data-action="submit-score">提交成绩</button>`;
}
