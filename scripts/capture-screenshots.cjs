const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const projectRoot = path.join(__dirname, '..');
const uiFile = path.join(projectRoot, 'ui', 'index.html');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asQueryObject = (queryText) => Object.fromEntries(new URLSearchParams(queryText).entries());

const targets = [
  {
    output: path.join(projectRoot, 'assets', 'product-screenshot-desktop.png'),
    width: 1360,
    height: 920,
    query: 'mode=desktop&demo=dashboard'
  },
  {
    output: path.join(projectRoot, 'assets', 'product-screenshot-extension.png'),
    width: 430,
    height: 860,
    query: 'mode=extension&demo=dashboard'
  },
  {
    output: path.join(projectRoot, 'assets', 'product-screenshot-onboarding.png'),
    width: 1360,
    height: 920,
    query: 'mode=desktop&demo=onboarding'
  }
];

const captureOne = async (target) => {
  const win = new BrowserWindow({
    width: target.width,
    height: target.height,
    show: false,
    backgroundColor: '#0b1216',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(uiFile, { query: asQueryObject(target.query) });
  await win.webContents.executeJavaScript(
    'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
    true
  );
  await win.webContents.executeJavaScript(
    `
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    true;
    `,
    true
  );
  await wait(900);

  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(target.output), { recursive: true });
  fs.writeFileSync(target.output, image.toPNG());

  win.destroy();
  console.log(`[tank-wallet] screenshot saved: ${path.relative(projectRoot, target.output)}`);
};

app.whenReady().then(async () => {
  for (const target of targets) {
    // Serialize captures to keep deterministic rendering.
    await captureOne(target);
  }
  app.quit();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
