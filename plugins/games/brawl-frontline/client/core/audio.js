/**
 * 音频系统：BGM 多文件清单 + 随机选曲 + 下一曲 + 音量
 * - 曲目清单从 ./audio/manifest.json 读取（JSON 字符串数组，如 ["a.mp3","b.ogg"]）
 * - 文件名任意，支持 mp3/ogg，无时长限制，缺失时静默失败
 * - 首次进入默认关闭（enabled=false），由"来听点音乐吧"弹窗引导开启
 * - 设置面板：音频开关 + 下一曲按钮 + 音量滑块
 * - 浏览器策略：需用户首次交互后 play() 才生效
 */
const MANIFEST_URL = './audio/manifest.json';

export const Audio = {
  enabled: false,          // 首次默认关闭，由弹窗或设置面板开启
  volume: 0.5,
  _tracks: [],             // 曲目文件名列表
  _index: 0,               // 当前播放曲目索引
  _el: null,               // 当前 audio 元素
  _ready: false,           // 当前曲目是否可播放
  _initStarted: false,

  /** 加载曲目清单（仅一次） */
  async init() {
    if (this._initStarted) return;
    this._initStarted = true;
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          this._tracks = list.filter(s => typeof s === 'string' && s.trim());
        }
      }
    } catch (e) { /* manifest 不存在或网络错误，静默 */ }
    if (this._tracks.length) {
      // 随机选一首作为起始
      this._index = Math.floor(Math.random() * this._tracks.length);
      this._loadCurrent(false);
    }
  },

  /** 加载当前索引曲目到 audio 元素；autoPlay=true 时就绪后自动播放 */
  _loadCurrent(autoPlay) {
    if (!this._tracks.length) return;
    const src = './audio/' + encodeURIComponent(this._tracks[this._index]);
    if (this._el) { try { this._el.pause(); } catch (e) {} }
    const el = document.createElement('audio');
    el.src = src;
    el.loop = true;             // 单曲循环（用户要求"随机抽选一首循环播放"）
    el.volume = this.volume;
    el.addEventListener('canplaythrough', () => {
      this._ready = true;
      if (this.enabled) this._playEl();
    });
    el.addEventListener('error', () => { this._ready = false; });
    this._el = el;
    this._ready = false;
    // preload
    el.load();
  },

  /** 实际播放 audio 元素（处理浏览器策略拒绝） */
  _playEl() {
    if (!this._el || !this._ready) return;
    this._el.volume = this.volume;
    const p = this._el.play();
    if (p && p.catch) p.catch(() => { /* 自动播放被阻止，忽略 */ });
  },

  /** 开始播放（用户首次交互后调用） */
  async play() {
    await this.init();
    if (!this.enabled) return;
    this._playEl();
  },

  /** 暂停 */
  pause() { if (this._el) { try { this._el.pause(); } catch (e) {} } },

  /** 切换开关：返回新状态 */
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) { this.init().then(() => this._playEl()); }
    else this.pause();
    return this.enabled;
  },

  /** 下一曲：随机切一首不同的曲目；单曲则重启 */
  next() {
    if (!this._tracks.length) return;
    if (this._tracks.length === 1) {
      if (this._el) { this._el.currentTime = 0; this._playEl(); }
      return;
    }
    let n;
    do { n = Math.floor(Math.random() * this._tracks.length); } while (n === this._index);
    this._index = n;
    this._loadCurrent(true);
  },

  /** 设置音量 0-1 */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._el) this._el.volume = this.volume;
  },

  /** 是否有可用曲目 */
  hasTracks() { return this._tracks.length > 0; },

  /** 当前曲目文件名（供 UI 显示） */
  currentName() { return this._tracks[this._index] || ''; }
};
