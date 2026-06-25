const fs = require('fs');
const path = require('path');

class ThemeEngine {
  constructor(options = {}) {
    this.themesDir = options.themesDir || path.join(__dirname, '..', '..', 'themes');
    this.themes = new Map();
    this.currentTheme = options.defaultTheme || 'default';
    this._loaded = false;
  }

  loadAll() {
    if (this._loaded) return;

    if (!fs.existsSync(this.themesDir)) {
      return;
    }

    const entries = fs.readdirSync(this.themesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const themeJsonPath = path.join(this.themesDir, entry.name, 'theme.json');
        if (fs.existsSync(themeJsonPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(themeJsonPath, 'utf-8'));
            const id = meta.id || entry.name;
            this.themes.set(id, {
              id,
              meta,
              dir: path.join(this.themesDir, entry.name),
              cssPath: `themes/${entry.name}/${meta.entry || 'index.css'}`
            });
          } catch (err) {
            console.error(`[ThemeEngine] Failed to load theme "${entry.name}":`, err.message);
          }
        }
      }
    }

    this._loaded = true;
    console.log(`[ThemeEngine] Loaded ${this.themes.size} themes`);
  }

  get(id) {
    return this.themes.get(id) || null;
  }

  list() {
    return Array.from(this.themes.values()).map(t => ({
      id: t.id,
      name: t.meta.name || t.id,
      description: t.meta.description || '',
      category: t.meta.category || 'light'
    }));
  }

  getCurrent() {
    return this.get(this.currentTheme);
  }

  setCurrent(id) {
    if (this.themes.has(id)) {
      this.currentTheme = id;
      return true;
    }
    return false;
  }
}

module.exports = ThemeEngine;
