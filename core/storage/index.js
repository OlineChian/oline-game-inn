const path = require('path');
const MemoryStore = require('./memory-store');
const FileStore = require('./file-store');

// 持久化数据文件位置：<项目根>/data/store.json
// 重启后自动加载，无需迁移；保留 MemoryStore 作为磁盘不可用时的兜底
const storeFile = path.join(__dirname, '..', '..', 'data', 'store.json');

let globalStore;
try {
  globalStore = new FileStore(storeFile);
  console.log(`[Storage] 持久化存储已启用：${storeFile}`);
} catch (err) {
  console.warn(`[Storage] FileStore 初始化失败，回退到内存存储：${err.message}`);
  globalStore = new MemoryStore();
}

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

module.exports = {
  globalStore,
  createPartitionedStore
};
