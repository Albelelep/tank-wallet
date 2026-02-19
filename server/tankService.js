import crypto from 'node:crypto';
import QRCode from 'qrcode';
import PeerWallet from 'trac-wallet';
import { AUTO_LOCK_MS, DEFAULT_BALANCES, SWAP_RATES } from './constants.js';
import { decryptMnemonic, encryptMnemonic, hashPassphrase, secureEqual } from './cryptoVault.js';
import { readVault, writeVault, vaultExists } from './storage.js';

const nowIso = () => new Date().toISOString();
const round4 = (num) => Number.parseFloat(num.toFixed(4));

const validatePassphrase = (passphrase) => {
  if (typeof passphrase !== 'string' || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }
};

const validateAsset = (asset) => {
  if (!['TNK', 'TRK'].includes(asset)) throw new Error('Asset must be TNK or TRK');
};

const validateAddress = (address) => {
  if (!/^trac1[0-9a-z]{20,}$/i.test(String(address || ''))) {
    throw new Error('Invalid TRAC address format');
  }
};

const parseAmount = (amount) => {
  const value = Number.parseFloat(String(amount));
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be greater than zero');
  return round4(value);
};

export class TankWalletService {
  constructor(options = {}) {
    this.autoLockMs = options.autoLockMs || AUTO_LOCK_MS;
    this.vault = vaultExists() ? readVault() : null;
    this.session = null;
    this.lockReason = this.vault ? 'locked' : 'no-vault';
    this.autoLockTimer = null;
  }

  get hasVault() {
    return Boolean(this.vault);
  }

  get isLocked() {
    return this.session === null;
  }

  state() {
    return {
      hasVault: this.hasVault,
      locked: this.isLocked,
      address: this.vault?.address || null,
      balances: this.vault?.balances || null,
      autoLockSeconds: Math.floor(this.autoLockMs / 1000),
      lockReason: this.lockReason,
      mode: 'local-bridge'
    };
  }

  touch() {
    if (!this.session) return;
    this.session.lastActivity = Date.now();
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = setTimeout(() => this.lock('auto-timeout'), this.autoLockMs);
  }

  requireUnlocked() {
    if (!this.session) throw new Error('Wallet is locked');
    this.touch();
    return this.session.wallet;
  }

  async #buildWalletFromMnemonic(mnemonic) {
    const wallet = new PeerWallet({ mnemonic: mnemonic || null });
    await wallet.ready;
    if (!wallet.address || !wallet.mnemonic) {
      await wallet.generateKeyPair(mnemonic || null, wallet.derivationPath || null);
    }
    if (!wallet.address || !wallet.mnemonic) {
      throw new Error('Wallet generation failed');
    }
    return wallet;
  }

  #persist() {
    if (!this.vault) return;
    this.vault.updatedAt = nowIso();
    writeVault(this.vault);
  }

  #appendActivity(item) {
    if (!this.vault) return;
    this.vault.activity = Array.isArray(this.vault.activity) ? this.vault.activity : [];
    this.vault.activity.unshift({
      id: crypto.randomUUID(),
      timestamp: nowIso(),
      ...item
    });
    this.vault.activity = this.vault.activity.slice(0, 100);
    this.#persist();
  }

  async createWallet({ passphrase, mnemonic = null }) {
    if (this.hasVault) throw new Error('Vault already exists');
    validatePassphrase(passphrase);

    const wallet = await this.#buildWalletFromMnemonic(mnemonic);
    const sanitized = wallet.sanitizeMnemonic(wallet.mnemonic);
    if (!sanitized) throw new Error('Wallet mnemonic validation failed');

    this.vault = {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      address: wallet.address,
      encryptedMnemonic: encryptMnemonic(sanitized, passphrase),
      passphraseHash: hashPassphrase(passphrase),
      balances: { ...DEFAULT_BALANCES },
      activity: [
        {
          id: crypto.randomUUID(),
          timestamp: nowIso(),
          type: 'bootstrap',
          message: 'TankWallet created'
        }
      ]
    };
    writeVault(this.vault);

    await this.unlock({ passphrase });
    return this.state();
  }

  async importWallet({ passphrase, mnemonic }) {
    if (this.hasVault) throw new Error('Vault already exists');
    validatePassphrase(passphrase);
    if (!mnemonic || typeof mnemonic !== 'string') throw new Error('Mnemonic is required');

    const wallet = await this.#buildWalletFromMnemonic(mnemonic.trim());
    const sanitized = wallet.sanitizeMnemonic(wallet.mnemonic);
    if (!sanitized) throw new Error('Invalid mnemonic phrase');

    this.vault = {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      address: wallet.address,
      encryptedMnemonic: encryptMnemonic(sanitized, passphrase),
      passphraseHash: hashPassphrase(passphrase),
      balances: { ...DEFAULT_BALANCES },
      activity: [
        {
          id: crypto.randomUUID(),
          timestamp: nowIso(),
          type: 'import',
          message: 'Wallet imported from mnemonic'
        }
      ]
    };
    writeVault(this.vault);

    await this.unlock({ passphrase });
    return this.state();
  }

  async unlock({ passphrase }) {
    if (!this.vault) throw new Error('No vault found. Create or import a wallet first.');
    validatePassphrase(passphrase);

    const expectedHash = this.vault.passphraseHash || '';
    const incomingHash = hashPassphrase(passphrase);
    if (!secureEqual(expectedHash, incomingHash)) throw new Error('Invalid passphrase');

    const mnemonic = decryptMnemonic(this.vault.encryptedMnemonic, passphrase);
    const wallet = await this.#buildWalletFromMnemonic(mnemonic);
    if (wallet.address !== this.vault.address) throw new Error('Vault integrity check failed');

    this.session = {
      wallet,
      unlockedAt: nowIso(),
      lastActivity: Date.now()
    };
    this.lockReason = 'unlocked';
    this.touch();
    return this.state();
  }

  lock(reason = 'manual') {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = null;

    if (this.session?.wallet?.secretKey && Buffer.isBuffer(this.session.wallet.secretKey)) {
      this.session.wallet.secretKey.fill(0);
    }
    this.session = null;
    this.lockReason = reason;
    return this.state();
  }

  getAddress() {
    if (!this.vault) throw new Error('No wallet available');
    return { address: this.vault.address };
  }

  async getAddressQr(size = 260) {
    const { address } = this.getAddress();
    const width = Number.isFinite(size) ? Math.max(128, Math.min(1024, size)) : 260;
    const dataUrl = await QRCode.toDataURL(address, {
      width,
      margin: 1,
      color: { dark: '#131722', light: '#f2f5ea' }
    });
    return { address, dataUrl };
  }

  send({ to, asset, amount, memo = '' }) {
    this.requireUnlocked();
    validateAddress(to);
    validateAsset(asset);
    const parsedAmount = parseAmount(amount);

    const current = Number(this.vault.balances?.[asset] || 0);
    if (current < parsedAmount) throw new Error(`Insufficient ${asset} balance`);

    this.vault.balances[asset] = round4(current - parsedAmount);
    const txRef = `tx-${crypto.randomUUID().slice(0, 8)}`;
    this.#appendActivity({
      type: 'send',
      asset,
      amount: parsedAmount,
      to,
      memo: String(memo || ''),
      txRef,
      status: 'broadcasted'
    });

    return {
      txRef,
      balances: this.vault.balances
    };
  }

  quoteSwap({ fromAsset, toAsset, amount }) {
    validateAsset(fromAsset);
    validateAsset(toAsset);
    if (fromAsset === toAsset) throw new Error('Swap pair must be different');
    const parsedAmount = parseAmount(amount);
    const key = `${fromAsset}_${toAsset}`;
    const rate = Number(SWAP_RATES[key]);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Unsupported swap pair');

    const gross = parsedAmount * rate;
    const fee = gross * 0.003;
    const receive = Math.max(0, gross - fee);

    return {
      fromAsset,
      toAsset,
      amount: parsedAmount,
      rate: round4(rate),
      fee: round4(fee),
      receive: round4(receive),
      expiresAt: new Date(Date.now() + 45_000).toISOString()
    };
  }

  executeSwap(payload) {
    this.requireUnlocked();
    const quote = this.quoteSwap(payload);

    const current = Number(this.vault.balances?.[quote.fromAsset] || 0);
    if (current < quote.amount) throw new Error(`Insufficient ${quote.fromAsset} balance`);

    this.vault.balances[quote.fromAsset] = round4(current - quote.amount);
    this.vault.balances[quote.toAsset] = round4(Number(this.vault.balances?.[quote.toAsset] || 0) + quote.receive);

    const swapRef = `swp-${crypto.randomUUID().slice(0, 8)}`;
    this.#appendActivity({
      type: 'swap',
      fromAsset: quote.fromAsset,
      toAsset: quote.toAsset,
      amount: quote.amount,
      receive: quote.receive,
      fee: quote.fee,
      rate: quote.rate,
      swapRef
    });

    return {
      swapRef,
      quote,
      balances: this.vault.balances
    };
  }

  activity(limit = 40) {
    if (!this.vault) return [];
    const max = Math.max(1, Math.min(200, Number.parseInt(`${limit}`, 10) || 40));
    return (this.vault.activity || []).slice(0, max);
  }
}
