const fs = require('fs');
const path = require('path');
const express = require('express');
const EventBus = require('./event-bus');
const { createPartitionedStore } = require('../storage');

class PluginManager {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || path.join(__dirname, '..', '..', 'plugins');
    this.config = options.config || { enabled: [], disabled: [], configs: {} };
    this.eventBus = options.eventBus || new EventBus();
    this.io = options.io || null;
    this.app = options.app || null;
    this.plugins = new Map();
    this._loaded = false;
  }

  loadAll() {
    if (this._loaded) return;

    const discovered = this._discoverPlugins();

    for (const item of discovered) {
      try {
        this._loadPlugin(item.id, item.dir, item.meta);
      } catch (err) {
        console.error(`[PluginManager] Failed to load "${item.id}":`, err.message);
      }
    }

    this._loaded = true;
    console.log(`[PluginManager] Loaded ${this.plugins.size} plugins`);
  }

  registerRoutes(app) {
    if (!app) return;

    for (const [id, plugin] of this.plugins) {
      const clientDir = path.join(plugin.dir, 'client');
      if (!fs.existsSync(clientDir)) continue;

      const type = plugin.meta.type || 'feature';
      const routePrefix = type === 'game' ? '/game' : '/plugins';
      const routePath = `${routePrefix}/${id}`;

      app.use(routePath, express.static(clientDir, {
        index: false,
        fallthrough: true
      }));

      app.get(routePath, (req, res) => {
        const indexPath = path.join(clientDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).json({ code: 404, message: 'Plugin page not found' });
        }
      });

      console.log(`[PluginManager] Route registered: ${routePath} → ${id}`);
    }
  }

  _discoverPlugins() {
    const result = [];

    if (!fs.existsSync(this.pluginsDir)) {
      return result;
    }

    const scanDir = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath = path.join(dir, entry.name);
        const pluginJsonPath = path.join(fullPath, 'plugin.json');
        const relativeId = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (fs.existsSync(pluginJsonPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
            const id = meta.id || relativeId;
            result.push({ id, dir: fullPath, meta });
          } catch (e) {
            console.warn(`[PluginManager] Invalid plugin.json in ${relativeId}`);
          }
        }

        scanDir(fullPath, relativeId);
      }
    };

    scanDir(this.pluginsDir);
    return result;
  }

  _loadPlugin(id, pluginDir, meta) {
    const isEnabled = this.config.enabled.includes(id);
    if (!isEnabled) {
      return null;
    }

    const entryFile = meta.entry?.server;
    let api = {};

    if (entryFile) {
      const entryPath = path.join(pluginDir, entryFile);
      if (!fs.existsSync(entryPath)) {
        console.warn(`[PluginManager] Entry not found for "${id}": ${entryFile}`);
      } else {
        const storage = createPartitionedStore(id);
        const pluginConfig = this.config.configs?.[id] || {};

        const context = {
          id,
          meta,
          config: pluginConfig,
          storage,
          eventBus: this.eventBus,
          io: this.io,
          app: this.app,
          pluginManager: {
            get: (pid) => this.get(pid),
            has: (pid) => this.has(pid),
            list: () => this.list(),
            getGamePlugins: () => this.getGamePlugins(),
            getFeaturePlugins: () => this.getFeaturePlugins(),
            getPluginsByType: (type) => this.getPluginsByType(type),
            getApi: (pid) => this.getApi(pid)
          },
          logger: {
            info: (msg) => console.log(`[${id}] ${msg}`),
            warn: (msg) => console.warn(`[${id}] ${msg}`),
            error: (msg) => console.error(`[${id}] ${msg}`),
            debug: (msg) => console.debug(`[${id}] ${msg}`)
          },
          http: {
            success: (data) => ({ code: 0, message: 'success', data, timestamp: Date.now() }),
            error: (code, message, details) => ({ code, message, details, timestamp: Date.now() })
          }
        };

        const factory = require(entryPath);
        api = typeof factory === 'function' ? factory(this.app, context) : factory;
      }
    }

    this.plugins.set(id, {
      id,
      meta,
      dir: pluginDir,
      api: api || {}
    });

    this.eventBus.emit('plugin:loaded', { id });
    console.log(`[PluginManager] Plugin loaded: ${id}`);
    return id;
  }

  get(id) {
    return this.plugins.get(id) || null;
  }

  has(id) {
    return this.plugins.has(id);
  }

  list() {
    return Array.from(this.plugins.keys());
  }

  getApi(id) {
    const plugin = this.plugins.get(id);
    return plugin ? plugin.api : null;
  }

  getPluginsByType(type) {
    return Array.from(this.plugins.values())
      .filter(p => p.meta.type === type && !p.meta.hidden)
      .map(p => ({
        id: p.id,
        name: p.meta.name,
        description: p.meta.description,
        icon: p.meta.icon,
        meta: p.meta,
        dir: p.dir
      }));
  }

  getGamePlugins() {
    return this.getPluginsByType('game');
  }

  getFeaturePlugins() {
    return this.getPluginsByType('feature');
  }
}

module.exports = PluginManager;