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
 *   - onQuit(): 玩家主动退出（无尽模式提交分数）
 *   - onStart(): 开始游戏（首屏）
 *   - onNextRound(): 进入下一关
 *   - onPickCandy(candyId): 三选一选牌
 *   - onBuyCandy(candyId, price): 商店指定购买
 *   - onSellCandy(candyId): 回收糖果
 *   - onCloseShop(): 关闭商店
 *   - onRefreshShop(): 刷新商店货架（阶段 5/7）
 *   - onBuySpecialItem(itemId): 购买特殊商品（阶段 6）
 *   - onUpgradeShop(): 升级商店等级（阶段 8）
 *   - onSubmitScore(): 提交分数到排行榜
 * 内部 action：
 *   - toggle-candy-info: 切换已拥有糖果卡片的效果显示（无需回调，直接 DOM 操作）
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
    else if (act === 'quit') handlers.onQuit && handlers.onQuit();
    else if (act === 'start') handlers.onStart();
    else if (act === 'next-round') handlers.onNextRound && handlers.onNextRound();
    else if (act === 'pick-candy') {
      handlers.onPickCandy && handlers.onPickCandy(action.dataset.candyId);
    } else if (act === 'buy-candy') {
      const price = Number(action.dataset.price);
      handlers.onBuyCandy && handlers.onBuyCandy(action.dataset.candyId, price);
    } else if (act === 'sell-candy') {
      handlers.onSellCandy && handlers.onSellCandy(action.dataset.candyId);
    } else if (act === 'upgrade-hand') {
      // 阶段 4：传递 toLevel 支持组合升级跨级
      const toLevel = action.dataset.toLevel ? Number(action.dataset.toLevel) : null;
      handlers.onUpgradeHand && handlers.onUpgradeHand(action.dataset.handKey, toLevel);
    } else if (act === 'refresh-shop') {
      // 阶段 5/7：刷新商店货架
      handlers.onRefreshShop && handlers.onRefreshShop();
    } else if (act === 'buy-special-item') {
      // 阶段 6：购买特殊商品
      handlers.onBuySpecialItem && handlers.onBuySpecialItem(action.dataset.itemId);
    } else if (act === 'upgrade-shop') {
      // 阶段 8：升级商店等级
      handlers.onUpgradeShop && handlers.onUpgradeShop();
    } else if (act === 'toggle-candy-info') {
      // 切换已拥有糖果卡片的效果显示（内部 DOM 操作，无需回调）
      const card = action.closest('.cc-shop-card');
      const desc = card && card.querySelector('.cc-shop-card-desc');
      if (desc) desc.classList.toggle('is-hidden');
    } else if (act === 'close-shop') {
      handlers.onCloseShop && handlers.onCloseShop();
    } else if (act === 'open-shop') {
      handlers.onOpenShop && handlers.onOpenShop();
    } else if (act === 'submit-score') {
      handlers.onSubmitScore && handlers.onSubmitScore();
    } else if (act === 'toggle-candy-panel') {
      handlers.onToggleCandyPanel && handlers.onToggleCandyPanel();
    } else if (act === 'open-settings') {
      handlers.onOpenSettings && handlers.onOpenSettings();
    } else if (act === 'close-settings') {
      handlers.onCloseSettings && handlers.onCloseSettings();
    } else if (act === 'temp-save') {
      handlers.onTempSave && handlers.onTempSave();
    } else if (act === 'retire') {
      handlers.onRetire && handlers.onRetire();
    } else if (act === 'confirm-retire') {
      handlers.onConfirmRetire && handlers.onConfirmRetire();
    } else if (act === 'cancel-retire') {
      handlers.onCancelRetire && handlers.onCancelRetire();
    } else if (act === 'continue-wave') {
      handlers.onContinueWave && handlers.onContinueWave();
    } else if (act === 'end-wave') {
      handlers.onEndWave && handlers.onEndWave();
    } else if (act === 'continue-game') {
      handlers.onContinueGame && handlers.onContinueGame();
    } else if (act === 'open-candy-collection') {
      handlers.onOpenCandyCollection && handlers.onOpenCandyCollection();
    } else if (act === 'close-collection') {
      handlers.onCloseCandyCollection && handlers.onCloseCandyCollection();
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
