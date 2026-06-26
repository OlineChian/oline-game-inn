'use strict';

/**
 * FileStore - 文件持久化存储
 *
 * 与 MemoryStore 接口完全一致，可直接替换。
 * - 启动时从 JSON 文件加载全部数据到内存 Map
 * - 写操作防抖落盘（默认 100ms 窗口合并多次写入）
 * - 使用「写临时文件 + rename」原子写入，避免崩溃导致文件损坏
 * - 监听 SIGINT/SIGTERM/beforeExit，进程退出时同步落盘
 * - 任何磁盘错误都不影响内存中的读写，仅记录日志
 *
 * 文件格式：JSON 数组，元素为 [key, value]，可直接传给 Map 构造器
 */
const fs = require('fs');
const path = require('path');

class FileStore {
  /**
   * @param {string} filePath 数据文件绝对路径
   * @param {object} [options]
   * @param {number} [options.writeDelay=100] 防抖写入延迟（毫秒）
   */
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.writeDelay = options.writeDelay || 100;
    this._data = new Map();
    this._dirty = false;
    this._writeTimer = null;
    this._exiting = false;

    this._ensureDir();
    this._load();

    // 进程退出时同步落盘，避免防抖未触发造成数据丢失
    process.on('SIGINT', () => this._onExit());
    process.on('SIGTERM', () => this._onExit());
    process.on('beforeExit', () => this._flushSync());
  }

  _ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      if (!raw.trim()) return;
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length === 2) {
            this._data.set(entry[0], entry[1]);
          }
        }
      }
    } catch (err) {
      console.error(`[FileStore] 加载失败 ${this.filePath}：${err.message}，将以空数据启动`);
      this._data = new Map();
    }
  }

  _scheduleWrite() {
    this._dirty = true;
    if (this._writeTimer) return;
    this._writeTimer = setTimeout(() => {
      this._writeTimer = null;
      this._flush();
    }, this.writeDelay);
  }

  _flush() {
    if (!this._dirty) return;
    this._dirty = false;
    try {
      this._writeFile();
    } catch (err) {
      console.error(`[FileStore] 落盘失败：${err.message}`);
    }
  }

  _flushSync() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    if (!this._dirty) return;
    this._dirty = false;
    try {
      this._writeFile();
    } catch (err) {
      console.error(`[FileStore] 同步落盘失败：${err.message}`);
    }
  }

  _writeFile() {
    // 原子写入：先写 .tmp 再 rename，避免崩溃导致主文件损坏
    const tmpPath = this.filePath + '.tmp';
    const entries = Array.from(this._data.entries());
    fs.writeFileSync(tmpPath, JSON.stringify(entries));
    fs.renameSync(tmpPath, this.filePath);
  }

  _onExit() {
    if (this._exiting) return;
    this._exiting = true;
    this._flushSync();
    // 让事件循环继续退出
    process.exit(0);
  }

  get(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }

  set(key, value) {
    this._data.set(key, value);
    this._scheduleWrite();
    return true;
  }

  delete(key) {
    const removed = this._data.delete(key);
    if (removed) this._scheduleWrite();
    return removed;
  }

  has(key) {
    return this._data.has(key);
  }

  list(prefix = '') {
    const result = [];
    for (const [key, value] of this._data) {
      if (!prefix || key.startsWith(prefix)) {
        result.push({ key, value });
      }
    }
    return result;
  }

  keys(prefix = '') {
    const result = [];
    for (const key of this._data.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }

  incr(key, amount = 1) {
    const current = this._data.get(key) || 0;
    const next = current + amount;
    this._data.set(key, next);
    this._scheduleWrite();
    return next;
  }

  decr(key, amount = 1) {
    return this.incr(key, -amount);
  }

  clear() {
    this._data.clear();
    this._scheduleWrite();
  }

  size() {
    return this._data.size;
  }
}

module.exports = FileStore;
