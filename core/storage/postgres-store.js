'use strict';

/**
 * PostgresStore - PostgreSQL 持久化存储
 *
 * 与 FileStore / MemoryStore 接口完全一致，可直接替换。
 * 设计原则：内存镜像 + 异步批量落库，对外保持同步 API。
 *
 * - 启动时一次性从 kv_store 表全量加载到内存 Map（this.ready）
 * - 读操作全部走内存 Map（同步，不访问数据库）
 * - 写操作立即改内存 Map + 加入 dirty 集合 + 触发防抖批量 UPSERT
 * - Flush 条件：距上次 Flush ≥ 1s，或 dirty 数量 ≥ 100
 * - 进程退出（SIGINT/SIGTERM/beforeExit）同步 Flush，避免防抖未触发丢数据
 * - 任何数据库异常只记录日志，不影响内存读写，保证最终一致性
 *
 * 数据库表：
 *   kv_store(key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())
 *
 * value 用 JSONB 存储，与 FileStore 的 JSON.stringify 行为一致。
 */
const fs = require('fs');
const path = require('path');

// 延迟加载 pg，避免本地开发未安装时报错
let pg = null;
function getPg() {
  if (pg === null) {
    try {
      pg = require('pg');
    } catch (err) {
      pg = false;
      console.error('[PostgresStore] 加载 pg 模块失败，请执行 npm install pg。错误：', err.message);
    }
  }
  return pg;
}

class PostgresStore {
  /**
   * @param {string} connectionString PostgreSQL 连接串
   * @param {object} [options]
   * @param {string} [options.tableName='kv_store'] 数据表名
   * @param {number} [options.flushInterval=1000] 防抖 Flush 间隔（毫秒）
   * @param {number} [options.flushThreshold=100] dirty 数量阈值，达到立即 Flush
   * @param {number} [options.maxConnections=10] 连接池最大连接数
   * @param {number} [options.loadRetries=3] 启动加载重试次数
   * @param {number} [options.loadRetryDelay=1000] 启动加载重试间隔（毫秒）
   */
  constructor(connectionString, options = {}) {
    if (!connectionString) {
      throw new Error('PostgresStore 需要 connectionString');
    }

    const pgModule = getPg();
    if (!pgModule) {
      throw new Error('pg 模块不可用');
    }

    this.tableName = options.tableName || 'kv_store';
    this.flushInterval = options.flushInterval || 1000;
    this.flushThreshold = options.flushThreshold || 100;
    this.loadRetries = options.loadRetries || 3;
    this.loadRetryDelay = options.loadRetryDelay || 1000;

    this._data = new Map();
    // dirty 用 Map<key, isDelete> 按 key 去重：同一 key 后写覆盖先写，
    // 避免 clear 后 set 同一 key 时 UPSERT 与 DELETE 同时进入 batch 导致误删
    this._dirty = new Map();
    this._flushTimer = null;
    this._lastFlushAt = 0;
    this._exiting = false;
    this._closed = false;

    // 连接池：Supabase 推荐 6543 端口（Pooler / Transaction mode）
    this.pool = new pgModule.Pool({
      connectionString,
      max: options.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    // 启动加载（异步），完成后 ready resolve
    this.ready = this._load().then(count => {
      console.log(`[PostgresStore] Connected, loaded ${count} keys`);
      console.log('[PostgresStore] Ready');
      return count;
    }).catch(err => {
      console.error('[PostgresStore] 初始加载失败：', err.message);
      // 抛出以便上层 index.js 回退到 MemoryStore
      throw err;
    });

    // 进程退出时同步落盘（pg 查询异步，用 drain 等待完成）
    this._sigintHandler = () => this._onExit();
    this._sigtermHandler = () => this._onExit();
    this._beforeExitHandler = () => this._drainPending().catch(() => {});
    process.on('SIGINT', this._sigintHandler);
    process.on('SIGTERM', this._sigtermHandler);
    process.on('beforeExit', this._beforeExitHandler);
  }

  // ---------- 启动加载 ----------

  async _load() {
    let lastErr = null;
    for (let attempt = 1; attempt <= this.loadRetries; attempt++) {
      try {
        await this._ensureTable();
        const client = await this.pool.connect();
        try {
          const res = await client.query(`SELECT key, value FROM ${this.tableName}`);
          for (const row of res.rows) {
            // value 是 JSONB，pg 驱动会自动解析为 JS 对象
            this._data.set(row.key, row.value);
          }
          return res.rowCount;
        } finally {
          client.release();
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[PostgresStore] 加载第 ${attempt}/${this.loadRetries} 次失败：${err.message}`);
        if (attempt < this.loadRetries) {
          await this._sleep(this.loadRetryDelay * attempt);
        }
      }
    }
    throw lastErr || new Error('加载失败');
  }

  async _ensureTable() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key        TEXT PRIMARY KEY,
          value      JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_updated ON ${this.tableName}(updated_at)
      `);
    } finally {
      client.release();
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- 读操作（同步，走内存） ----------

  get(key) {
    return this._data.has(key) ? this._data.get(key) : null;
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

  size() {
    return this._data.size;
  }

  // ---------- 写操作（同步改内存 + 标记 dirty + 防抖落库） ----------

  set(key, value) {
    this._data.set(key, value);
    this._markDirty(key);
    return true;
  }

  delete(key) {
    const removed = this._data.delete(key);
    if (removed) {
      // 删除也要落库：用一个内部墓碑标记，flush 时统一 DELETE
      this._markDirty(key, true);
    }
    return removed;
  }

  incr(key, amount = 1) {
    const current = this._data.get(key) || 0;
    const next = current + amount;
    this._data.set(key, next);
    this._markDirty(key);
    return next;
  }

  decr(key, amount = 1) {
    return this.incr(key, -amount);
  }

  clear() {
    if (this._data.size === 0) return;
    // 把所有现有 key 标记为待删除，再清空内存
    for (const key of this._data.keys()) {
      this._markDirty(key, true);
    }
    this._data.clear();
  }

  _markDirty(key, isDelete = false) {
    this._dirty.set(key, isDelete);
    // 达到阈值立即 Flush
    if (this._dirty.size >= this.flushThreshold) {
      this._scheduleImmediateFlush();
    } else {
      this._scheduleFlush();
    }
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    const elapsed = Date.now() - this._lastFlushAt;
    const delay = Math.max(0, this.flushInterval - elapsed);
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, delay);
  }

  _scheduleImmediateFlush() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    // 立即异步触发，不阻塞调用方
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, 0);
  }

  // ---------- 落库 ----------

  _flush() {
    if (this._dirty.size === 0) return;
    // batch 格式：[[key, isDelete], ...]
    const batch = Array.from(this._dirty.entries());
    this._dirty.clear();
    this._lastFlushAt = Date.now();

    // 异步执行，不阻塞调用栈
    this._executeFlush(batch).catch(err => {
      console.error('[PostgresStore] Flush failed:', err.message);
      // 失败的 key 重新加入 dirty，等下次重试
      for (const [key, isDelete] of batch) {
        this._dirty.set(key, isDelete);
      }
      this._scheduleFlush();
    });
  }

  // batch 格式：[[key, isDelete], ...]
  async _executeFlush(batch) {
    if (batch.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 分两组：upsert 与 delete
      const upserts = batch.filter(([, isDelete]) => !isDelete);
      const deletes = batch.filter(([, isDelete]) => isDelete);

      // 批量 UPSERT：一次多 VALUES + ON CONFLICT
      if (upserts.length > 0) {
        const valuesClauses = [];
        const params = [];
        let idx = 1;
        for (const [key] of upserts) {
          const value = this._data.get(key);
          // _normalizeForPgJsonb 返回 JSON 字符串（而非 JS 对象），
          // 避免 pg prepareValue 对 Array 调用 arrayString 转为 PG 数组字面量
          const jsValue = this._normalizeForPgJsonb(value);
          valuesClauses.push(`($${idx}, $${idx + 1})`);
          params.push(key, jsValue);
          idx += 2;
        }
        const sql = `
          INSERT INTO ${this.tableName} (key, value)
          VALUES ${valuesClauses.join(', ')}
          ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        `;
        await client.query(sql, params);
      }

      // 批量 DELETE
      if (deletes.length > 0) {
        const deleteKeys = deletes.map(([key]) => key);
        await client.query(
          `DELETE FROM ${this.tableName} WHERE key = ANY($1::text[])`,
          [deleteKeys]
        );
      }

      await client.query('COMMIT');
      console.log(`[PostgresStore] Flushed ${batch.length} keys`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  _normalizeForPgJsonb(value) {
    // ⚠️ 关键修复：必须返回 JSON 字符串，而非 JS 对象/数组。
    //
    // 原因：pg 驱动的 prepareValue()（node_modules/pg/lib/utils.js）对 JS Array
    // 会调用 arrayString() 转为 PostgreSQL 数组字面量，而非 JSON 数组：
    //   [] → arrayString([]) → '{}' → JSONB 列存为空对象 {}（而非空数组 []）
    //   [{...}] → arrayString → '{"{...}"}' → 非法 JSON，INSERT 失败
    // 而非 Array 的对象才走 prepareObject() → JSON.stringify，行为正确。
    //
    // 这导致 FileStore（JSON.stringify 全量序列化，Array→'[...]'）与
    // PostgresStore（pg arrayString，Array→'{...}'）数据类型不一致：
    //   FileStore 读回 []（Array，iterable）✓
    //   PostgresStore 读回 {}（Object，非 iterable）✗ → "board is not iterable"
    //
    // 修复：统一返回 JSON.stringify(value) 字符串。pg 对 string 参数直接
    // 发送给 JSONB 列，由 PostgreSQL 解析为正确的 JSONB 类型：
    //   '[]' → JSONB 数组 [] → 读回 []（Array）✓
    //   '{}' → JSONB 对象 {} → 读回 {}（Object）✓
    //   '[1,2]' → JSONB 数组 → 读回 [1,2]（Array）✓
    // 与 FileStore 的 JSON.stringify → JSON.parse 行为完全一致。
    if (value === null || value === undefined) {
      return null;
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      // 序列化失败（如循环引用）则存 null，避免阻塞
      console.warn('[PostgresStore] value 序列化失败，存为 null:', e.message);
      return null;
    }
  }

  // 异步等待所有 dirty 落库完成（pg 不支持同步查询，故退出时用 async drain）
  async _drainPending() {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._dirty.size === 0) return 0;

    const batch = Array.from(this._dirty.entries());
    this._dirty.clear();
    try {
      await this._executeFlush(batch);
      return batch.length;
    } catch (err) {
      console.error('[PostgresStore] 退出时 Flush 失败:', err.message);
      // 失败的 key 放回 dirty，尽力保留（但进程即将退出，仅记日志）
      for (const [key, isDelete] of batch) {
        this._dirty.set(key, isDelete);
      }
      return 0;
    }
  }

  async _onExit() {
    if (this._exiting) return;
    this._exiting = true;
    const count = await this._drainPending();
    if (count > 0) {
      console.log(`[PostgresStore] 退出时落库 ${count} keys`);
    }
    await this.close();
    process.exit(0);
  }

  // ---------- 关闭 ----------

  /**
   * 重新从数据库全量加载到内存 Map（管理员手动触发）。
   *
   * 用于外部直接修改 kv_store 表后，让运行中的进程内存镜像同步更新，
   * 无需重启服务。流程：
   *   1. 先 drainPending 落盘当前 dirty，避免未持久化写丢失
   *   2. 备份当前 _data，加载失败时回滚保证服务可用
   *   3. 清空 _data 与 _dirty，重新 _load
   *   4. 失败则恢复备份
   *
   * 注意：reload 期间并发的读会读到部分加载的数据，属预期（管理员手动操作）。
   *
   * @returns {Promise<{driver:string, keys:number}>}
   */
  async reload() {
    // 1. 先落盘未持久化的修改
    await this._drainPending();

    // 2. 备份当前数据
    const backup = new Map(this._data);

    // 3. 清空内存镜像与 dirty，重新加载
    this._data.clear();
    this._dirty.clear();
    try {
      const count = await this._load();
      console.log(`[PostgresStore] Reloaded ${count} keys`);
      return { driver: 'postgres', keys: count };
    } catch (err) {
      // 加载失败，恢复旧数据，保证服务可用
      this._data = backup;
      console.error('[PostgresStore] reload 失败，已恢复旧数据:', err.message);
      throw err;
    }
  }

  async close() {
    if (this._closed) return;
    this._closed = true;
    try {
      // 最后一次同步 Flush
      if (this._dirty.size > 0) {
        const batch = Array.from(this._dirty);
        this._dirty.clear();
        await this._executeFlush(batch).catch(err => {
          console.error('[PostgresStore] 关闭时 Flush 失败:', err.message);
        });
      }
    } finally {
      try {
        process.removeListener('SIGINT', this._sigintHandler);
        process.removeListener('SIGTERM', this._sigtermHandler);
        process.removeListener('beforeExit', this._beforeExitHandler);
      } catch (e) {}
      await this.pool.end();
      console.log('[PostgresStore] Connection closed');
    }
  }
}

module.exports = PostgresStore;
