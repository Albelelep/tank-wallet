import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_BYTES = 32;
const PBKDF2_DIGEST = 'sha512';

const toBase64 = (buf) => Buffer.from(buf).toString('base64');
const fromBase64 = (text) => Buffer.from(text, 'base64');

export const hashPassphrase = (passphrase) =>
  crypto.createHash('sha256').update(String(passphrase), 'utf8').digest('hex');

export const secureEqual = (a, b) => {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

export const encryptMnemonic = (mnemonic, passphrase) => {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(String(passphrase), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, PBKDF2_DIGEST);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(String(mnemonic), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  key.fill(0);

  return {
    algo: 'aes-256-gcm',
    kdf: 'pbkdf2-sha512',
    iterations: PBKDF2_ITERATIONS,
    iv: toBase64(iv),
    salt: toBase64(salt),
    authTag: toBase64(authTag),
    data: toBase64(encrypted)
  };
};

export const decryptMnemonic = (payload, passphrase) => {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid encrypted payload');
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const authTag = fromBase64(payload.authTag);
  const data = fromBase64(payload.data);
  const iterations = Number.parseInt(payload.iterations || `${PBKDF2_ITERATIONS}`, 10);

  const key = crypto.pbkdf2Sync(String(passphrase), salt, iterations, PBKDF2_KEY_BYTES, PBKDF2_DIGEST);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plain;
  try {
    plain = Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (_err) {
    key.fill(0);
    throw new Error('Invalid passphrase');
  }
  key.fill(0);
  return plain.toString('utf8');
};
