const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const OUT_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8001;
const liveReloadClients = new Set();

function notifyReload() {
  for (const res of liveReloadClients) {
    res.write('event: reload\n');
    res.write('data: now\n\n');
  }
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn(process.execPath, [path.join(__dirname, 'build.js')], {
      stdio: 'inherit',
    });

    buildProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
  });
}

let isBuilding = false;
let pendingBuild = false;

async function triggerBuild() {
  if (isBuilding) {
    pendingBuild = true;
    return;
  }

  isBuilding = true;
  try {
    await runBuild();
    notifyReload();
  } catch (error) {
    console.error(error.message || error);
  } finally {
    isBuilding = false;
    if (pendingBuild) {
      pendingBuild = false;
      triggerBuild();
    }
  }
}

let debounceTimer;
function scheduleBuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerBuild();
  }, 150);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.xml':
      return 'application/xml; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function resolveFilePath(requestPath) {
  const normalized = decodeURIComponent(requestPath.split('?')[0]);
  const trimmed = normalized.replace(/^\/+/, '');
  const relativePath = trimmed === '' ? 'index.html' : trimmed;

  const candidate = path.join(OUT_DIR, relativePath);
  if (!candidate.startsWith(OUT_DIR)) {
    return null;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return path.join(candidate, 'index.html');
  }

  if (relativePath.endsWith('/')) {
    return path.join(OUT_DIR, relativePath, 'index.html');
  }

  return candidate;
}

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/__livereload')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('event: connected\n');
      res.write('data: ok\n\n');
      liveReloadClients.add(res);

      req.on('close', () => {
        liveReloadClients.delete(res);
      });
      return;
    }

    const filePath = resolveFilePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

function startWatcher() {
  const watcher = chokidar.watch([
    path.join(__dirname, 'posts'),
    path.join(__dirname, 'drafts'),
    path.join(__dirname, 'style.css'),
    path.join(__dirname, 'script.js'),
  ], {
    ignoreInitial: true,
  });

  watcher.on('all', (event, filePath) => {
    console.log(`[watch] ${event}: ${filePath}`);
    scheduleBuild();
  });
}

async function main() {
  await triggerBuild();
  startServer();
  startWatcher();
}

main();
