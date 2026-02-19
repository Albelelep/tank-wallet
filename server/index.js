import http from 'node:http';
import { URL } from 'node:url';
import { APP_NAME, API_PREFIX, HOST, PORT, UPSTREAMS } from './constants.js';
import { TankWalletService } from './tankService.js';

const service = new TankWalletService();

const json = (res, statusCode, payload) => {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
};

const fail = (res, statusCode, error) => json(res, statusCode, { ok: false, error: String(error?.message || error) });

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (_err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const handlers = {
  'GET /health': async () => ({
    ok: true,
    app: APP_NAME,
    timestamp: new Date().toISOString(),
    upstreams: UPSTREAMS
  }),

  'GET /state': async () => ({
    ok: true,
    state: service.state()
  }),

  'POST /wallet/create': async ({ body }) => ({
    ok: true,
    state: await service.createWallet({
      passphrase: body.passphrase,
      mnemonic: body.mnemonic || null
    })
  }),

  'POST /wallet/import': async ({ body }) => ({
    ok: true,
    state: await service.importWallet({
      passphrase: body.passphrase,
      mnemonic: body.mnemonic
    })
  }),

  'POST /wallet/unlock': async ({ body }) => ({
    ok: true,
    state: await service.unlock({ passphrase: body.passphrase })
  }),

  'POST /wallet/lock': async () => ({
    ok: true,
    state: service.lock('manual')
  }),

  'GET /wallet/address': async () => ({
    ok: true,
    ...service.getAddress()
  }),

  'GET /wallet/address/qr': async ({ url }) => ({
    ok: true,
    ...(await service.getAddressQr(Number.parseInt(url.searchParams.get('size') || '260', 10)))
  }),

  'POST /send': async ({ body }) => ({
    ok: true,
    ...(service.send({
      to: body.to,
      asset: body.asset,
      amount: body.amount,
      memo: body.memo
    }))
  }),

  'POST /swap/quote': async ({ body }) => ({
    ok: true,
    quote: service.quoteSwap({
      fromAsset: body.fromAsset,
      toAsset: body.toAsset,
      amount: body.amount
    })
  }),

  'POST /swap/execute': async ({ body }) => ({
    ok: true,
    ...(service.executeSwap({
      fromAsset: body.fromAsset,
      toAsset: body.toAsset,
      amount: body.amount
    }))
  }),

  'GET /activity': async ({ url }) => ({
    ok: true,
    activity: service.activity(Number.parseInt(url.searchParams.get('limit') || '40', 10))
  })
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (!url.pathname.startsWith(API_PREFIX)) {
    return fail(res, 404, 'Unknown path');
  }

  const path = url.pathname.slice(API_PREFIX.length) || '/';
  const key = `${req.method || 'GET'} ${path}`;
  const handler = handlers[key];
  if (!handler) return fail(res, 404, `No route for ${key}`);

  try {
    const body = req.method === 'POST' ? await parseBody(req) : {};
    const payload = await handler({ req, res, url, body });
    return json(res, 200, payload);
  } catch (err) {
    const message = String(err?.message || err);
    const status = /invalid|required|unsupported|must|insufficient|exists|locked|vault/i.test(message) ? 400 : 500;
    return fail(res, status, message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[tank-wallet] bridge ready at http://${HOST}:${PORT}${API_PREFIX}`);
});
