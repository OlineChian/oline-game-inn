/**
 * Navbar Component
 * 全站统一导航栏
 * 
 * 使用方式：
 * 1. 在页面中添加 <div id="site-navbar"></div>
 * 2. 引入本文件：<script src="/navbar.js"></script>
 * 3. 调用：renderNavbar('home') — 传入当前页面标识
 * 
 * 页面标识：
 *   'home'      - 首页
 *   'games'     - 游戏大厅（与首页同页，用 #games 区分）
 *   'leaderboard' - 排行榜
 *   'activity'  - 活动中心
 */

function renderNavbar(currentPage) {
  var container = document.getElementById('site-navbar');
  if (!container) return;

  var links = [
    { id: 'home',       icon: '&#x1F3E0;', label: '首页',       href: '/' },
    { id: 'games',      icon: '&#x1F3AE;', label: '游戏大厅',    href: '/#games' },
    { id: 'leaderboard', icon: '&#x1F3C6;', label: '排行榜',     href: '/leaderboard.html' },
    { id: 'activity',   icon: '&#x1F381;', label: '活动中心',   href: '/activity.html' }
  ];

  var html = '<div class="navbar-brand"><a href="/" class="navbar-brand">&#x1F3E0; <span>Oline荒野</span></a></div>';
  html += '<div class="navbar-links">';

  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var isActive = (link.id === currentPage) ? ' active' : '';
    html += '<a href="' + link.href + '" class="navbar-link' + isActive + '">' + link.icon + ' <span>' + link.label + '</span></a>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// 自动渲染（如果容器存在）
document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('site-navbar');
  if (container && container.getAttribute('data-page')) {
    renderNavbar(container.getAttribute('data-page'));
  }
});
