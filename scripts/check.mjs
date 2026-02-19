import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const required = [
  'package.json',
  'README.md',
  'COMMIT_MESSAGES.md',
  'server/index.js',
  'server/tankService.js',
  'ui/index.html',
  'ui/app.js',
  'ui/app.css',
  'desktop/main.cjs',
  'desktop/preload.cjs',
  'extension/manifest.json',
  'extension/popup.html',
  'scripts/run-electron.cjs',
  'scripts/capture-screenshots.cjs',
  'assets/logo-tank.svg',
  'assets/product-screenshot-desktop.png',
  'assets/product-screenshot-extension.png',
  'assets/product-screenshot-onboarding.png'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Missing required files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const manifestPath = path.join(root, 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  console.error('Extension manifest must use version 3');
  process.exit(1);
}

console.log('[tank-wallet] local file check passed');
