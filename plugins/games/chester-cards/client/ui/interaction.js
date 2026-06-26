/**
 * 切斯特牌 - 交互模块
 * 绑定手牌选择、出牌、弃牌、重启按钮事件
 * 通过事件委托统一处理，避免重复绑定
 */

let bound = false;

/**
 * 初始化交互层
 * @param {Object} handlers 回调集合
 *   - onSelect(cardId): 点击手牌
 *   - onPlay(): 出牌
 *   - onDiscard(): 弃牌
 *   - onRestart(): 重新开始
 *   - onStart(): 开始游戏（首屏）
 *   - onNextRound(): 进入下一关
 *   - onPickCandy(candyId): 三选一选牌
 *   - onBuyCandy(candyId, price): 商店指定购买
 *   - onDrawRandom(): 商店随机抽选
 *   - onSellCandy(candyId): 回收糖果
 *   - onCloseShop(): 关闭商店
 *   - onSubmitScore(): 提交分数到排行榜
 */
export function setupInteraction(handlers) {
  if (bound) return;
  bound = true;

  const root = document.getElementById('chesterStage');

  // 事件委托：手牌点击
  root.addEventListener('click', (e) => {
    const card = e.target.closest('.cc-card');
    if (card && card.dataset.id) {
      handlers.onSelect(card.dataset.id);
      return;
    }

    // 糖果槽点击 → 翻面展示效果
    const candy = e.target.closest('.cc-candy-slot.has-candy');
    if (candy) {
      candy.classList.toggle('is-flipped');
      return;
    }

    const action = e.target.closest('[data-action]');
    if (!action) return;
    const act = action.dataset.action;
    if (act === 'play') handlers.onPlay();
    else if (act === 'discard') handlers.onDiscard();
    else if (act === 'restart') handlers.onRestart();
    else if (act === 'start') handlers.onStart();
    else if (act === 'next-round') handlers.onNextRound && handlers.onNextRound();
    else if (act === 'pick-candy') {
      handlers.onPickCandy && handlers.onPickCandy(action.dataset.candyId);
    } else if (act === 'buy-candy') {
      const price = Number(action.dataset.price);
      handlers.onBuyCandy && handlers.onBuyCandy(action.dataset.candyId, price);
    } else if (act === 'draw-random') {
      handlers.onDrawRandom && handlers.onDrawRandom();
    } else if (act === 'sell-candy') {
      handlers.onSellCandy && handlers.onSellCandy(action.dataset.candyId);
    } else if (act === 'upgrade-hand') {
      handlers.onUpgradeHand && handlers.onUpgradeHand(action.dataset.handKey);
    } else if (act === 'close-shop') {
      handlers.onCloseShop && handlers.onCloseShop();
    } else if (act === 'open-shop') {
      handlers.onOpenShop && handlers.onOpenShop();
    } else if (act === 'submit-score') {
      handlers.onSubmitScore && handlers.onSubmitScore();
    }
  });

  // 键盘快捷键：Enter 出牌 / Backspace 弃牌 / R 重启
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') handlers.onPlay();
    else if (e.key === 'Backspace' || e.key === 'Delete') handlers.onDiscard();
    else if (e.key === 'r' || e.key === 'R') handlers.onRestart();
  });
}
