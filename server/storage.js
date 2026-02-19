import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, VAULT_FILE } from './constants.js';

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
};

export const vaultExists = () => fs.existsSync(VAULT_FILE);

export const readVault = () => {
  if (!vaultExists()) return null;
  const raw = fs.readFileSync(VAULT_FILE, 'utf8');
  return JSON.parse(raw);
};

export const writeVault = (vault) => {
  ensureDataDir();
  const tempPath = path.join(DATA_DIR, '.vault.tmp');
  fs.writeFileSync(tempPath, JSON.stringify(vault, null, 2), 'utf8');
  fs.renameSync(tempPath, VAULT_FILE);
};
