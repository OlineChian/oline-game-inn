/**
 * 客户端成绩提交签名工具
 *
 * 配合 leaderboard 插件 server/security.js 的验签逻辑：
 *   - 签名算法 HMAC-SHA256
 *   - 签名内容 gameId|nickname|score|timestamp|nonce（与服务端保持一致）
 *   - HMAC key = SECRET + ':' + gameId（按游戏派生）
 *
 * 使用方式：
 *   const sig = await ScoreSigner.sign({ gameId: '8bit-arcade', nickname: '玩家', score: 100 });
 *   fetch('/api/leaderboard/8bit-arcade', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ nickname, score, extra, ...sig })
 *   });
 *
 * 返回 sig = { timestamp, nonce, signature }
 *
 * 安全说明：
 *   - 密钥硬编码在客户端，会被反编译，属已知局限。
 *   - 本机制作为第一道防线，挡住"抓包直接改 score 值"和"重放完整包"两类最低成本攻击。
 *   - 无法防"脱离客户端直接构造合法签名"（需服务端游戏会话才能进一步加固）。
 *   - 依赖 Web Crypto API（crypto.subtle），需 HTTPS 或 localhost 环境。
 */

(function () {
  // 与服务端 security.js 的 DEFAULT_SECRET 保持一致。
  // 生产环境服务端通过 SCORE_SIGN_SECRET 环境变量覆盖；
  // 若客户端需使用生产密钥，应在构建时注入替换此常量。
  var SECRET = 'oline-score-sign-dev-default';

  function deriveKey(gameId) {
    return SECRET + ':' + gameId;
  }

  function buildMessage(payload) {
    return [
      payload.gameId,
      payload.nickname,
      String(payload.score),
      String(payload.timestamp),
      payload.nonce
    ].join('|');
  }

  function randomNonce() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    var hex = '';
    for (var i = 0; i < arr.length; i++) {
      hex += arr[i].toString(16).padStart(2, '0');
    }
    // 附加时间戳 base36，降低极端情况下随机数碰撞概率
    return hex + '_' + Date.now().toString(36);
  }

  function bufToHex(buf) {
    var bytes = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * 生成成绩提交签名
   * @param {{gameId:string, nickname:string, score:(number|string)}} payload
   * @returns {Promise<{timestamp:number, nonce:string, signature:string}>}
   */
  async function sign(payload) {
    if (!payload || !payload.gameId || payload.nickname === undefined || payload.score === undefined) {
      throw new Error('ScoreSigner.sign 缺少必要参数 gameId/nickname/score');
    }
    var timestamp = Date.now();
    var nonce = randomNonce();
    var message = new TextEncoder().encode(buildMessage({
      gameId: payload.gameId,
      nickname: String(payload.nickname),
      score: payload.score,
      timestamp: timestamp,
      nonce: nonce
    }));
    var keyData = new TextEncoder().encode(deriveKey(payload.gameId));
    var key = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    var sigBuf = await crypto.subtle.sign('HMAC', key, message);
    return {
      timestamp: timestamp,
      nonce: nonce,
      signature: bufToHex(sigBuf)
    };
  }

  window.ScoreSigner = { sign: sign };
})();
