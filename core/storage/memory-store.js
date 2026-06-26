class MemoryStore {
  constructor() {
    this._data = new Map();
  }

  get(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }

  set(key, value) {
    this._data.set(key, value);
    return true;
  }

  delete(key) {
    return this._data.delete(key);
  }

  has(key) {
    return this._data.has(key);
  }

  list(prefix = '') {
    const result = [];
    for (const [key, value] of this._data) {
      if (key.startsWith(prefix)) {
        result.push({ key, value });
      }
    }
    return result;
  }

  keys(prefix = '') {
    const result = [];
    for (const key of this._data.keys()) {
      if (key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }

  incr(key, amount = 1) {
    const current = this._data.get(key) || 0;
    const next = current + amount;
    this._data.set(key, next);
    return next;
  }

  decr(key, amount = 1) {
    return this.incr(key, -amount);
  }

  clear() {
    this._data.clear();
  }

  size() {
    return this._data.size;
  }

  /**
   * MemoryStore 无外部持久化源，reload 无数据可重载。
   * 返回当前内存 key 数，保持接口与 FileStore/PostgresStore 一致。
   *
   * @returns {Promise<{driver:string, keys:number}>}
   */
  async reload() {
    return { driver: 'memory', keys: this._data.size };
  }
}

module.exports = MemoryStore;
