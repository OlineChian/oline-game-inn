const MemoryStore = require('./memory-store');

const globalStore = new MemoryStore();

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
