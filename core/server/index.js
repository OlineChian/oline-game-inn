const path = require('path');
const EventBus = require('./event-bus');
const PluginManager = require('./plugin-manager');
const ThemeEngine = require('../theme-engine');
const { globalStore } = require('../storage');

let initialized = false;
let coreInstance = null;

function initCore(app, io) {
  if (initialized) return coreInstance;

  try {
    const pluginsConfigPath = path.join(__dirname, '..', '..', 'config', 'plugins.json');
    let pluginsConfig = { enabled: [], disabled: [], configs: {} };

    try {
      const fs = require('fs');
      if (fs.existsSync(pluginsConfigPath)) {
        pluginsConfig = JSON.parse(fs.readFileSync(pluginsConfigPath, 'utf-8'));
      }
    } catch (err) {
      console.warn('[Core] Failed to load plugins config:', err.message);
    }

    const eventBus = new EventBus();
    const themeEngine = new ThemeEngine();
    const pluginManager = new PluginManager({
      pluginsDir: path.join(__dirname, '..', '..', 'plugins'),
      config: pluginsConfig,
      eventBus,
      io,
      app
    });

    themeEngine.loadAll();
    pluginManager.loadAll();
    pluginManager.registerRoutes(app);

    coreInstance = {
      eventBus,
      pluginManager,
      themeEngine,
      storage: globalStore,
      config: {
        plugins: pluginsConfig
      }
    };

    initialized = true;
    console.log('[Core] Core framework initialized');

    return coreInstance;
  } catch (err) {
    console.error('[Core] Failed to initialize core:', err);
    console.warn('[Core] Falling back to legacy mode (no plugins)');
    return null;
  }
}

module.exports = {
  initCore,
  get core() {
    return coreInstance;
  }
};