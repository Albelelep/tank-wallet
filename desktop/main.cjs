const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const bridgePort = process.env.TANKWALLET_PORT || '49333';

let bridgeProc = null;
let mainWindow = null;

const isDevtoolsShortcut = (input) => {
  const key = String(input.key || '').toUpperCase();
  return (
    key === 'F12' ||
    ((input.control || input.meta) && input.shift && ['I', 'J', 'C'].includes(key))
  );
};

const startBridge = () => {
  if (bridgeProc) return;
  const entry = path.join(projectRoot, 'server', 'index.js');
  bridgeProc = spawn(process.execPath, [entry], {
    cwd: projectRoot,
    env: { ...process.env, TANKWALLET_PORT: bridgePort },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  bridgeProc.stdout.on('data', (chunk) => {
    process.stdout.write(`[tank-bridge] ${chunk}`);
  });
  bridgeProc.stderr.on('data', (chunk) => {
    process.stderr.write(`[tank-bridge] ${chunk}`);
  });
  bridgeProc.on('exit', () => {
    bridgeProc = null;
  });
};

const stopBridge = () => {
  if (!bridgeProc) return;
  bridgeProc.kill();
  bridgeProc = null;
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#0b1216',
    title: 'TankWallet',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (isDevtoolsShortcut(input)) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadFile(path.join(projectRoot, 'ui', 'index.html'), {
    query: {
      mode: 'desktop',
      apiRoot: `http://127.0.0.1:${bridgePort}`
    }
  });
};

ipcMain.handle('tankwallet:setSecureInput', (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  win.setContentProtection(Boolean(enabled));
  return true;
});

ipcMain.handle('tankwallet:openExternal', async (_event, url) => {
  if (!/^https?:\/\//.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

app.whenReady().then(async () => {
  startBridge();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('before-quit', () => {
  stopBridge();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
