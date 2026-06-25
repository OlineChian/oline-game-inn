(function(global) {
  'use strict';

  const components = new Map();
  let initialized = false;

  function initRuntime() {
    if (initialized) return;

    try {
      const eventBus = new global.CoreEventBus();

      const runtime = {
        eventBus: eventBus,
        api: global.CoreAPI,

        components: {
          register: function(name, component) {
            components.set(name, component);
          },
          get: function(name) {
            return components.get(name) || null;
          },
          has: function(name) {
            return components.has(name);
          },
          list: function() {
            return Array.from(components.keys());
          }
        },

        theme: {
          current: 'default',
          switchTo: function(themeId) {
            document.documentElement.setAttribute('data-theme', themeId);
            this.current = themeId;
            eventBus.emit('theme:changed', themeId);
          },
          onChange: function(handler) {
            return eventBus.on('theme:changed', handler);
          }
        },

        utils: {
          escapeHtml: function(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
          },
          debounce: function(fn, delay) {
            let timer = null;
            return function() {
              const args = arguments;
              const ctx = this;
              clearTimeout(timer);
              timer = setTimeout(function() {
                fn.apply(ctx, args);
              }, delay);
            };
          },
          throttle: function(fn, delay) {
            let last = 0;
            return function() {
              const now = Date.now();
              if (now - last >= delay) {
                last = now;
                fn.apply(this, arguments);
              }
            };
          },
          formatDate: function(date, format) {
            const d = new Date(date);
            const pad = function(n) { return n < 10 ? '0' + n : n; };
            format = format || 'YYYY-MM-DD';
            return format
              .replace('YYYY', d.getFullYear())
              .replace('MM', pad(d.getMonth() + 1))
              .replace('DD', pad(d.getDate()))
              .replace('HH', pad(d.getHours()))
              .replace('mm', pad(d.getMinutes()))
              .replace('ss', pad(d.getSeconds()));
          }
        }
      };

      initialized = true;
      global.AppRuntime = runtime;

      eventBus.emit('runtime:ready');
      console.log('[Runtime] Core runtime initialized');

      return runtime;
    } catch (err) {
      console.error('[Runtime] Failed to initialize:', err);
      return null;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRuntime);
  } else {
    initRuntime();
  }

  global.initRuntime = initRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
