(function() {
  const btn = document.getElementById('testBtn');
  const result = document.getElementById('testResult');
  let clickCount = 0;

  btn.addEventListener('click', function() {
    clickCount++;
    result.textContent = `🎉 按钮被点击了 ${clickCount} 次 - JS 运行正常！`;
  });

  console.log('[test-demo] Plugin JS loaded successfully');
})();