const path = require('path');
const MemoryStore = require('./memory-store');
const FileStore = require('./file-store');

/**
 * 可插拔 Storage Driver
 *
 * 通过环境变量 STORE_DRIVER 切换：
 *   - file     (默认) 本地文件持久化，data/store.json，无需数据库
 *   - postgres 生产环境，需 DATABASE_URL 指向 PostgreSQL 连接串
 *
 * 初始化失败时回退到 MemoryStore（仅内存，重启丢失），并打印 WARN。
 * 未来可继续扩展 redis / sqlite / memory 等 driver，只需在 drivers 注册。
 *
 * 所有 driver 接口与 FileStore 一致，createPartitionedStore 无需感知底层。
 */

// 本地 FileStore 数据文件位置：<项目根>/data/store.json
const storeFile = path.join(__dirname, '..', '..', 'data', 'store.json');

/**
 * 根据 STORE_DRIVER + 环境变量创建底层 store 实例。
 * 返回 { store, ready }：
 *   - store: 已同步可用的实例（读操作可立即调用，但 postgres 模式下数据可能仍在加载）
 *   - ready: Promise，resolve 后表示数据已加载完毕，可开始服务请求
 */
function createStore() {
  const driver = (process.env.STORE_DRIVER || 'file').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;

  if (driver === 'postgres') {
    if (!databaseUrl) {
      console.warn('[Storage] STORE_DRIVER=postgres 但未设置 DATABASE_URL，回退到 MemoryStore');
      return { store: new MemoryStore(), ready: Promise.resolve() };
    }
    try {
      const PostgresStore = require('./postgres-store');
      const pgStore = new PostgresStore(databaseUrl, {
        tableName: process.env.STORE_TABLE || 'kv_store'
      });
      console.log(`[Storage] Driver: postgres`);
      return { store: pgStore, ready: pgStore.ready };
    } catch (err) {
      console.warn(`[Storage] PostgresStore 初始化失败，回退到 MemoryStore：${err.message}`);
      return { store: new MemoryStore(), ready: Promise.resolve() };
    }
  }

  if (driver === 'memory') {
    console.log('[Storage] Driver: memory');
    return { store: new MemoryStore(), ready: Promise.resolve() };
  }

  // 默认 file
  try {
    const fileStore = new FileStore(storeFile);
    console.log(`[Storage] Driver: file (${storeFile})`);
    return { store: fileStore, ready: Promise.resolve() };
  } catch (err) {
    console.warn(`[Storage] FileStore 初始化失败，回退到 MemoryStore：${err.message}`);
    return { store: new MemoryStore(), ready: Promise.resolve() };
  }
}

let globalStore;
const _created = createStore();
globalStore = _created.store;

/**
 * ready Promise：数据加载完毕。
 * - FileStore / MemoryStore：立即 resolve
 * - PostgresStore：DB 全量加载完成后 resolve；失败则回退到 MemoryStore
 *
 * bootstrap 启动时应 await globalStore.ready 后再初始化插件，避免排行榜为空。
 * 注意：ready 不会 reject（失败时内部回退到 MemoryStore 并 resolve），
 * 这样 bootstrap 的 await 不会抛错。
 */
const storeReady = _created.ready.then(
  (v) => v,
  (err) => {
    console.warn(`[Storage] 数据加载失败，运行时回退到 MemoryStore（数据将不持久）：${err.message}`);
    const fallback = new MemoryStore();
    fallback.ready = Promise.resolve();
    // createPartitionedStore 闭包引用模块级 globalStore（let），reassign 后自动生效
    globalStore = fallback;
  }
);
globalStore.ready = storeReady;

function createPartitionedStore(namespace) {
  const prefix = `${namespace}:`;

  return {
    get(key) {
      return globalStore.get(prefix + key);
    },

    set(key, value) {
      return globalStore.set(prefix + key, value);
    },

    delete(key) {
      return globalStore.delete(prefix + key);
    },

    has(key) {
      return globalStore.has(prefix + key);
    },

    list(keyPrefix = '') {
      const fullPrefix = prefix + keyPrefix;
      return globalStore.list(fullPrefix).map(item => ({
        key: item.key.slice(prefix.length),
        value: item.value
      }));
    },

    keys(keyPrefix = '') {
      const fullPrefix = prefix + keyPrefix;
      return globalStore.keys(fullPrefix).map(k => k.slice(prefix.length));
    },

    incr(key, amount = 1) {
      return globalStore.incr(prefix + key, amount);
    },

    decr(key, amount = 1) {
      return globalStore.decr(prefix + key, amount);
    }
  };
}

/**
 * 获取当前生效的 globalStore 实例。
 *
 * 用于管理员接口等需要运行时访问底层 store 的场景。
 * 注意：module.exports.globalStore 是模块加载时的引用快照，
 * 当 PostgresStore 加载失败回退到 MemoryStore 时（globalStore 被 reassign），
 * 解构拿到的旧引用会悬空；getGlobalStore() 始终返回 reassign 后的最新实例。
 */
function getGlobalStore() {
  return globalStore;
}

module.exports = {
  globalStore,
  getGlobalStore,
  createPartitionedStore
};
