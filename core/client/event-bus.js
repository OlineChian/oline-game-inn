(function(global) {
  'use strict';

  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, handler) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }

    once(event, handler) {
      const wrapped = function() {
        this.off(event, wrapped);
        handler.apply(null, arguments);
      }.bind(this);
      return this.on(event, wrapped);
    }

    off(event, handler) {
      const listeners = this._listeners.get(event);
      if (listeners) {
        listeners.delete(handler);
      }
    }

    emit(event) {
      const args = Array.prototype.slice.call(arguments, 1);
      const listeners = this._listeners.get(event);
      if (listeners) {
        for (const handler of listeners) {
          try {
            handler.apply(null, args);
          } catch (err) {
            console.error('[EventBus] Error in handler for "' + event + '":', err);
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
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
  } else {
    global.CoreEventBus = EventBus;
  }
})(typeof window !== 'undefined' ? window : globalThis);
