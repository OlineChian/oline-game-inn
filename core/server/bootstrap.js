const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const { initCore } = require('./index');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..', '..');

function bootstrap() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  const publicDir = path.join(ROOT_DIR, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  app.use(express.static(ROOT_DIR, {
    index: false,
    fallthrough: true
  }));

  app.get('/', (req, res) => {
    const indexPath = path.join(ROOT_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  const core = initCore(app, io);

  if (!core) {
    console.warn('[Bootstrap] Core initialization failed, running minimal server');
  }

  server.listen(PORT, () => {
    console.log('========================================');
    console.log('  Oline荒野游戏客栈 - Core 服务器');
    console.log('========================================');
    console.log(`  端口: ${PORT}`);
    console.log(`  主页: http://localhost:${PORT}/`);
    console.log('========================================');
    if (core?.pluginManager) {
      const gamePlugins = Array.from(core.pluginManager.plugins.values())
        .filter(p => p.meta.type === 'game');
      if (gamePlugins.length > 0) {
        console.log('  游戏插件:');
        for (const p of gamePlugins) {
          console.log(`    - ${p.meta.name}: http://localhost:${PORT}/game/${p.id}`);
        }
      }
    }
    console.log('========================================');
  });

  return { app, server, io, core };
}

if (require.main === module) {
  bootstrap();
}

module.exports = { bootstrap, PORT };
