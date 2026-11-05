import { app, BrowserWindow, dialog, shell } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join, delimiter } from 'node:path';

let mainWindow;
let backend;
let serverOrigin;
let quitting = false;
let closeApproved = false;

function runtimePaths() {
  const root = join(process.resourcesPath, 'qa-runtime');
  const node = join(root, 'bin', 'node.exe');
  const server = join(root, 'dashboard', 'server.mjs');
  const browsers = join(root, 'browsers');
  for (const path of [node, server, join(root, 'dashboard', 'dist', 'index.html')]) {
    if (!existsSync(path)) throw Error('Incomplete desktop installation: ' + path);
  }
  const data = join(app.getPath('userData'), 'data');
  mkdirSync(data, { recursive: true });
  return { root, node, server, browsers, data };
}

function stopBackend() {
  if (!backend?.pid) return;
  const pid = backend.pid;
  backend = null;
  // /T terminates nested Playwright workers and local demo fixtures on Windows.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore', timeout: 12000,
    });
  } else {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already exited */ }
  }
}

function startBackend() {
  const { root, node, server, browsers, data } = runtimePaths();
  const env = {
    ...process.env,
    DASHBOARD_DATA_DIR: data,
    DASHBOARD_PORT: '0',
    PLAYWRIGHT_BROWSERS_PATH: browsers,
    QA_DESKTOP_MODE: '1',
    QA_REMOTE_APPROVAL: '',
    PATH: join(root, 'bin') + delimiter + (process.env.PATH ?? ''),
  };
  return new Promise((resolve, reject) => {
    const proc = spawn(node, [server], {
      cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    backend = proc;
    let settled = false;
    let output = '';
    let stderr = '';
    const timeout = setTimeout(() => finish(Error('The local runner did not start.')), 25000);
    function finish(error, url) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(url);
    }
    proc.on('error', finish);
    proc.on('exit', (code) => {
      backend = null;
      finish(Error('Local runner exited ' + code + ': ' + stderr.slice(-350)));
      if (mainWindow && !quitting) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'QA Control Center',
          message: 'The local test runner stopped.',
          detail: 'Restart QA Control Center to recover interrupted test runs.',
        });
      }
    });
    proc.stdout.on('data', (chunk) => {
      output = (output + String(chunk)).slice(-1500);
      const found = output.match(/QA Control Center listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (found) finish(null, found[1]);
    });
    proc.stderr.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(-1500); });
  });
}

function allowedExternal(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname === 'github.com' &&
      url.pathname.startsWith('/LalithSiramdasu/playwright-ui-api-automation-framework');
  } catch { return false; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'QA Control Center',
    width: 1350, height: 880, minWidth: 350, minHeight: 580,
    show: false, backgroundColor: '#f5f5f1', autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const own = new URL(serverOrigin);
      if (target.origin === own.origin && target.pathname.startsWith('/reports/')) {
        shell.openExternal(target.href);
      } else if (allowedExternal(url)) shell.openExternal(url);
    } catch { /* deny untrusted URL */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, href) => {
    if (href !== serverOrigin && !href.startsWith(serverOrigin + '/')) event.preventDefault();
  });
  mainWindow.on('close', (event) => {
    if (quitting || closeApproved) return;
    event.preventDefault();
    fetch(serverOrigin + '/api/health')
      .then((response) => response.json())
      .then(({ activeId }) => {
        if (activeId) {
          const answer = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            title: 'QA Control Center',
            buttons: ['Keep running', 'Stop tests and exit'],
            defaultId: 0, cancelId: 0,
            message: 'A Playwright run is still active.',
            detail: 'Exiting interrupts the run; completed history remains saved.',
          });
          if (answer !== 1) return;
        }
        closeApproved = true;
        mainWindow.close();
      })
      .catch(() => { closeApproved = true; mainWindow.close(); });
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(serverOrigin);
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { quitting = true; stopBackend(); });
app.whenReady().then(async () => {
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.on('web-contents-created', (_, contents) => {
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  });
  try {
    serverOrigin = await startBackend();
    createWindow();
  } catch (error) {
    stopBackend();
    dialog.showErrorBox('QA Control Center could not start', String(error.message ?? error));
    app.quit();
  }
});
