class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };
    return this.on(event, wrapped);
  }

  off(event, handler) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(handler);
    }
  }

  emit(event, ...args) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const handler of listeners) {
        try {
          handler(...args);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  listenerCount(event) {
    const listeners = this._listeners.get(event);
    return listeners ? listeners.size : 0;
  }
}

module.exports = EventBus;
