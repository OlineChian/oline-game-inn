/**
 * GameHeader Component
 * 游戏页统一顶部栏
 * 
 * 使用方式：
 * 1. 在页面 <body> 添加 class="has-game-header"
 * 2. 在 <body> 开头添加 <div id="site-game-header"></div>
 * 3. 引入：<link rel="stylesheet" href="/game-header.css">
 * 4. 引入：<script src="/game-header.js"></script>
 * 5. 调用：renderGameHeader({ title: '游戏名', backUrl: '/', showLeaderboard: true })
 */

function renderGameHeader(options) {
  var container = document.getElementById('site-game-header');
  if (!container) return;

  var title = options.title || '游戏';
  var backUrl = options.backUrl || '/';
  var showLeaderboard = options.showLeaderboard !== false;

  var html = '';
  html += '<a href="' + backUrl + '" class="game-header-back">&#x2190; 返回</a>';
  html += '<div class="game-header-title">' + title + '</div>';
  html += '<div class="game-header-actions">';
  if (showLeaderboard) {
    html += '<button class="game-header-btn" onclick="showLeaderboard()">&#x1F3C6; 排行榜</button>';
  }
  html += '</div>';

  container.innerHTML = html;
}
