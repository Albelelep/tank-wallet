import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'TankWallet';
export const API_PREFIX = '/api/v1';
export const HOST = '127.0.0.1';
export const PORT = Number.parseInt(process.env.TANKWALLET_PORT || '49333', 10);
export const AUTO_LOCK_MS = Number.parseInt(process.env.TANKWALLET_AUTO_LOCK_MS || `${5 * 60 * 1000}`, 10);

export const DATA_DIR = process.env.TANKWALLET_DATA_DIR
  ? path.resolve(process.env.TANKWALLET_DATA_DIR)
  : path.join(os.homedir(), '.tankwallet');
export const VAULT_FILE = path.join(DATA_DIR, 'vault.json');

export const DEFAULT_BALANCES = Object.freeze({
  TNK: 250,
  TRK: 120
});

export const SWAP_RATES = Object.freeze({
  TNK_TRK: 0.52,
  TRK_TNK: 1.9
});

export const UPSTREAMS = Object.freeze({
  forkBase: 'https://github.com/TracSystems/intercom-swap',
  walletTech: 'https://github.com/Trac-Systems/trac-wallet'
});
