const query = new URLSearchParams(window.location.search);
const injected = window.__TANKWALLET_CONFIG__ || {};

const runtimeMode = String(injected.mode || query.get('mode') || 'web').toLowerCase();
const apiRoot = String(injected.apiRoot || query.get('apiRoot') || 'http://127.0.0.1:49333').replace(/\/$/, '');
const apiBase = `${apiRoot}/api/v1`;
const demoMode = String(query.get('demo') || '').toLowerCase();
const isDemo = Boolean(demoMode);

if (runtimeMode === 'extension') document.body.classList.add('mode-extension');

const app = document.getElementById('app');
const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
});

const DEMO_ADDRESS = 'trac1tankwallet9r9y2m7g8j4f5k6n8p2q3r5t8u9w0x3y2z7a5b';

const state = {
  remote: null,
  addressQr: null,
  activity: [],
  quote: null,
  status: { type: '', text: '' },
  secureInput: false,
  scanner: null,
  draft: {}
};

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const demoQrDataUrl = (text) => {
  const payload = `
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
    <rect width="320" height="320" fill="#edf2de"/>
    <rect x="16" y="16" width="288" height="288" fill="#111823"/>
    <rect x="28" y="28" width="80" height="80" fill="#edf2de"/>
    <rect x="212" y="28" width="80" height="80" fill="#edf2de"/>
    <rect x="28" y="212" width="80" height="80" fill="#edf2de"/>
    <rect x="52" y="52" width="32" height="32" fill="#111823"/>
    <rect x="236" y="52" width="32" height="32" fill="#111823"/>
    <rect x="52" y="236" width="32" height="32" fill="#111823"/>
    <rect x="126" y="24" width="14" height="14" fill="#edf2de"/>
    <rect x="148" y="24" width="14" height="14" fill="#edf2de"/>
    <rect x="170" y="24" width="14" height="14" fill="#edf2de"/>
    <rect x="126" y="52" width="14" height="14" fill="#edf2de"/>
    <rect x="154" y="52" width="14" height="14" fill="#edf2de"/>
    <rect x="182" y="52" width="14" height="14" fill="#edf2de"/>
    <rect x="126" y="80" width="14" height="14" fill="#edf2de"/>
    <rect x="154" y="80" width="14" height="14" fill="#edf2de"/>
    <rect x="182" y="80" width="14" height="14" fill="#edf2de"/>
    <rect x="120" y="126" width="14" height="14" fill="#edf2de"/>
    <rect x="142" y="126" width="14" height="14" fill="#edf2de"/>
    <rect x="164" y="126" width="14" height="14" fill="#edf2de"/>
    <rect x="186" y="126" width="14" height="14" fill="#edf2de"/>
    <rect x="120" y="148" width="14" height="14" fill="#edf2de"/>
    <rect x="164" y="148" width="14" height="14" fill="#edf2de"/>
    <rect x="208" y="148" width="14" height="14" fill="#edf2de"/>
    <rect x="120" y="170" width="14" height="14" fill="#edf2de"/>
    <rect x="142" y="170" width="14" height="14" fill="#edf2de"/>
    <rect x="208" y="170" width="14" height="14" fill="#edf2de"/>
    <rect x="120" y="192" width="14" height="14" fill="#edf2de"/>
    <rect x="164" y="192" width="14" height="14" fill="#edf2de"/>
    <rect x="186" y="192" width="14" height="14" fill="#edf2de"/>
    <rect x="208" y="192" width="14" height="14" fill="#edf2de"/>
    <text x="160" y="304" text-anchor="middle" fill="#edf2de" font-size="11" font-family="monospace">${text}</text>
  </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(payload)}`;
};

const buildDemoState = (mode) => {
  const activity = [
    {
      id: 'demo-1',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      type: 'send',
      asset: 'TNK',
      amount: 5,
      to: 'trac1recipient0fh8a3c2m5zz0vz58x9f3a4agc2n6j4y',
      txRef: 'tx-demo-a12f'
    },
    {
      id: 'demo-2',
      timestamp: new Date(Date.now() - 1000 * 60 * 33).toISOString(),
      type: 'swap',
      fromAsset: 'TRK',
      toAsset: 'TNK',
      amount: 3,
      receive: 5.683,
      fee: 0.017,
      rate: 1.9,
      swapRef: 'swp-demo-92af'
    },
    {
      id: 'demo-3',
      timestamp: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
      type: 'bootstrap',
      message: 'TankWallet initialized'
    }
  ];

  const quote = {
    fromAsset: 'TNK',
    toAsset: 'TRK',
    amount: 8,
    rate: 0.52,
    fee: 0.0125,
    receive: 4.1475,
    expiresAt: new Date(Date.now() + 1000 * 42).toISOString()
  };

  if (mode === 'onboarding') {
    return {
      remote: {
        hasVault: false,
        locked: true,
        address: null,
        balances: null,
        lockReason: 'no-vault',
        autoLockSeconds: 300
      },
      addressQr: null,
      activity: [],
      quote: null,
      status: { type: 'warn', text: 'Demo mode: onboarding scene.' }
    };
  }

  if (mode === 'locked') {
    return {
      remote: {
        hasVault: true,
        locked: true,
        address: DEMO_ADDRESS,
        balances: { TNK: 240.5, TRK: 88.1 },
        lockReason: 'manual',
        autoLockSeconds: 300
      },
      addressQr: demoQrDataUrl('LOCKED PREVIEW'),
      activity,
      quote: null,
      status: { type: 'warn', text: 'Demo mode: locked wallet scene.' }
    };
  }

  return {
    remote: {
      hasVault: true,
      locked: false,
      address: DEMO_ADDRESS,
      balances: { TNK: 245.25, TRK: 93.4 },
      lockReason: 'unlocked',
      autoLockSeconds: 300
    },
    addressQr: demoQrDataUrl('TANKWALLET'),
    activity,
    quote,
    status: { type: '', text: 'Demo mode: dashboard scene.' }
  };
};

const setStatus = (text, type = '') => {
  state.status = { text: String(text || ''), type: String(type || '') };
  render();
};

const api = async (path, method = 'GET', body = null) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_err) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
};

const callSecureInput = async (enabled) => {
  if (state.secureInput === enabled) return;
  state.secureInput = enabled;
  document.body.classList.toggle('secure-input-active', enabled);
  if (window.tankDesktop?.setSecureInput) {
    try {
      await window.tankDesktop.setSecureInput(Boolean(enabled));
    } catch (_err) {}
  }
};

const refresh = async () => {
  const payload = await api('/state');
  state.remote = payload.state;
  state.quote = null;

  if (state.remote.hasVault) {
    const [qr, activity] = await Promise.all([api('/wallet/address/qr?size=280'), api('/activity?limit=25')]);
    state.addressQr = qr.dataUrl;
    state.activity = activity.activity || [];
  } else {
    state.addressQr = null;
    state.activity = [];
  }
  render();
};

const modeLabel = runtimeMode === 'extension' ? 'chrome-extension' : runtimeMode;

const heading = () => `
  <header class="topbar">
    <div class="brand">
      <img src="../assets/logo-tank.svg" alt="TankWallet logo" />
      <div class="brand-text">
        <span class="eyebrow">Connect with DeFi on Trac</span>
        <h1>TankWallet</h1>
        <p>TNK/TRK wallet with local lock, send/receive QR, and swap flow</p>
      </div>
    </div>
    <div class="badge-row">
      <div class="pill">${esc(modeLabel)}</div>
      ${isDemo ? '<div class="pill pill-demo">demo</div>' : ''}
    </div>
  </header>
`;

const statusLine = () => {
  if (!state.status.text) return '';
  return `<div class="status ${esc(state.status.type)}">${esc(state.status.text)}</div>`;
};

const onboardingView = () => `
  ${heading()}
  ${statusLine()}
  <div class="secure-banner">
    Sensitive phrase mode is active on mnemonic fields: clipboard copy is blocked and desktop capture protection is requested.
  </div>
  <section class="grid">
    <article class="card col-6">
      <h2>Create Wallet</h2>
      <p>Create a new wallet in seconds. You can leave mnemonic empty to auto-generate it locally.</p>
      <form id="createForm">
        <label for="createPassphrase">Passphrase</label>
        <input id="createPassphrase" type="password" minlength="8" placeholder="At least 8 characters" data-draft="createPassphrase" />

        <label for="createPassphrase2">Confirm passphrase</label>
        <input id="createPassphrase2" type="password" minlength="8" placeholder="Repeat passphrase" data-draft="createPassphrase2" />

        <label for="createMnemonic">Optional mnemonic</label>
        <textarea id="createMnemonic" placeholder="12 or 24 words (optional)" data-draft="createMnemonic" data-secure-input="1"></textarea>

        <button type="submit">Create TankWallet</button>
      </form>
    </article>

    <article class="card col-6">
      <h2>Import Wallet</h2>
      <p>Restore from an existing phrase and continue on desktop or extension mode.</p>
      <form id="importForm">
        <label for="importPassphrase">Passphrase</label>
        <input id="importPassphrase" type="password" minlength="8" placeholder="At least 8 characters" data-draft="importPassphrase" />

        <label for="importPassphrase2">Confirm passphrase</label>
        <input id="importPassphrase2" type="password" minlength="8" placeholder="Repeat passphrase" data-draft="importPassphrase2" />

        <label for="importMnemonic">Mnemonic</label>
        <textarea id="importMnemonic" placeholder="12 or 24 words" data-draft="importMnemonic" data-secure-input="1"></textarea>

        <button type="submit" class="warn">Import Existing Wallet</button>
      </form>
    </article>

    <article class="card col-12">
      <h3>Quick Start Route</h3>
      <ol class="journey-list">
        <li>Create or import wallet</li>
        <li>Unlock with passphrase</li>
        <li>Receive via QR or copy address</li>
        <li>Send TNK/TRK and swap when needed</li>
      </ol>
      <p class="hint">Phrase never leaves local vault API. You can lock wallet at any time from dashboard.</p>
    </article>
  </section>
`;

const lockedView = () => `
  ${heading()}
  ${statusLine()}
  <section class="grid">
    <article class="card col-7">
      <h2>Unlock TankWallet</h2>
      <p>Vault detected for <span class="mono">${esc(state.remote?.address || '-')}</span>.</p>
      <form id="unlockForm">
        <label for="unlockPassphrase">Passphrase</label>
        <input id="unlockPassphrase" type="password" minlength="8" placeholder="Enter your passphrase" data-draft="unlockPassphrase" data-secure-input="1" />
        <button type="submit">Unlock Wallet</button>
      </form>
    </article>

    <article class="card col-5">
      <h2>Security Lock</h2>
      <p>Current lock reason: <strong>${esc(state.remote?.lockReason || 'locked')}</strong></p>
      <p class="hint">Auto-lock timeout: ${esc(state.remote?.autoLockSeconds || 0)} seconds after inactivity.</p>
      <p class="hint">Tip: unlock only when you are ready to sign a send or swap flow.</p>
    </article>
  </section>
`;

const activityMarkup = () => {
  if (!state.activity.length) return '<p class="empty">No activity yet.</p>';
  return `
    <ul class="activity-list">
      ${state.activity
        .map((item) => {
          const meta = [];
          if (item.asset) meta.push(`${item.asset} ${item.amount}`);
          if (item.to) meta.push(`to ${item.to}`);
          if (item.fromAsset && item.toAsset) meta.push(`${item.fromAsset} -> ${item.toAsset}`);
          if (item.txRef) meta.push(item.txRef);
          if (item.swapRef) meta.push(item.swapRef);
          if (item.message) meta.push(item.message);
          return `
          <li>
            <strong>${esc(item.type || 'event')}</strong>
            <div>${esc(meta.join(' | ') || '-')}</div>
            <time>${esc(item.timestamp || '')}</time>
          </li>
        `;
        })
        .join('')}
    </ul>
  `;
};

const quoteMarkup = () => {
  if (!state.quote) return '<p class="hint">Request a quote before executing swap.</p>';
  return `
    <div class="status">
      Quote: ${esc(state.quote.amount)} ${esc(state.quote.fromAsset)} -> ${esc(state.quote.receive)} ${esc(state.quote.toAsset)}<br />
      Rate ${esc(state.quote.rate)} | Fee ${esc(state.quote.fee)} ${esc(state.quote.toAsset)}<br />
      Expires at ${esc(state.quote.expiresAt)}
    </div>
  `;
};

const dashboardView = () => {
  const balances = state.remote?.balances || { TNK: 0, TRK: 0 };

  return `
    ${heading()}
    ${statusLine()}
    <section class="grid">
      <article class="card col-4">
        <h2>Balances</h2>
        <div class="balance-grid">
          <div class="balance">
            <small>TNK</small>
            <strong>${amountFormatter.format(Number(balances.TNK || 0))}</strong>
          </div>
          <div class="balance">
            <small>TRK</small>
            <strong>${amountFormatter.format(Number(balances.TRK || 0))}</strong>
          </div>
        </div>
        <div class="actions" style="margin-top: 12px;">
          <button id="refreshBtn" class="secondary" type="button">Refresh</button>
          <button id="lockBtn" class="bad" type="button">Lock Wallet</button>
        </div>
      </article>

      <article class="card col-8">
        <h2>Receive</h2>
        <p>Show wallet address as text and QR. Share whichever is easier for the sender.</p>
        <div class="address-box mono" id="addressBox">${esc(state.remote?.address || '-')}</div>
        <div class="actions" style="margin-top: 8px;">
          <button id="copyAddressBtn" type="button" class="secondary">Copy Address</button>
        </div>
        ${state.addressQr ? `<img class="qr" src="${state.addressQr}" alt="Wallet address QR" />` : '<p class="hint">QR not loaded.</p>'}
      </article>

      <article class="card col-6">
        <h3>Send</h3>
        <form id="sendForm">
          <label for="sendTo">Destination address</label>
          <input id="sendTo" type="text" placeholder="trac1..." data-draft="sendTo" />
          <div class="actions">
            <button id="scanToBtn" type="button" class="ghost">Scan QR</button>
          </div>

          <label for="sendAsset">Asset</label>
          <select id="sendAsset" data-draft="sendAsset">
            <option value="TNK">TNK</option>
            <option value="TRK">TRK</option>
          </select>

          <label for="sendAmount">Amount</label>
          <input id="sendAmount" type="number" min="0.0001" step="0.0001" placeholder="0.00" data-draft="sendAmount" />

          <label for="sendMemo">Memo (optional)</label>
          <input id="sendMemo" type="text" placeholder="Optional memo" data-draft="sendMemo" />

          <button type="submit">Send Asset</button>
        </form>
      </article>

      <article class="card col-6">
        <h3>Swap</h3>
        <form id="swapForm">
          <label for="swapFrom">From</label>
          <select id="swapFrom" data-draft="swapFrom">
            <option value="TNK">TNK</option>
            <option value="TRK">TRK</option>
          </select>

          <label for="swapTo">To</label>
          <select id="swapTo" data-draft="swapTo">
            <option value="TRK">TRK</option>
            <option value="TNK">TNK</option>
          </select>

          <label for="swapAmount">Amount</label>
          <input id="swapAmount" type="number" min="0.0001" step="0.0001" placeholder="0.00" data-draft="swapAmount" />

          <div class="actions">
            <button id="quoteBtn" type="button" class="secondary">Get Quote</button>
            <button id="executeSwapBtn" type="submit">Execute Swap</button>
          </div>
        </form>
        <div id="quoteBox">${quoteMarkup()}</div>
      </article>

      <article class="card col-12">
        <h3>Activity</h3>
        ${activityMarkup()}
      </article>
    </section>

    <section id="scanner" class="scanner hidden" aria-hidden="true">
      <div class="scanner-panel">
        <h3>Scan Address QR</h3>
        <video id="scannerVideo" autoplay playsinline muted></video>
        <p class="scanner-note">Point camera to a QR code that contains a TRAC address.</p>
        <div class="actions">
          <button id="scannerCloseBtn" type="button" class="secondary">Close Scanner</button>
        </div>
      </div>
    </section>
  `;
};

const attachDraft = () => {
  document.querySelectorAll('[data-draft]').forEach((element) => {
    const key = element.getAttribute('data-draft');
    if (!key) return;
    if (state.draft[key] !== undefined) element.value = state.draft[key];
    element.addEventListener('input', () => {
      state.draft[key] = element.value;
    });
  });
};

const attachSecureInputs = () => {
  document.querySelectorAll('[data-secure-input="1"]').forEach((element) => {
    element.addEventListener('focus', () => {
      callSecureInput(true);
    });
    element.addEventListener('blur', () => {
      callSecureInput(false);
    });
    element.addEventListener('copy', (event) => event.preventDefault());
    element.addEventListener('cut', (event) => event.preventDefault());
  });
};

const stopScanner = () => {
  const overlay = document.getElementById('scanner');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  const running = state.scanner;
  if (!running) return;
  if (running.raf) cancelAnimationFrame(running.raf);
  if (running.stream) {
    for (const track of running.stream.getTracks()) track.stop();
  }
  state.scanner = null;
};

const startScanner = async (targetInputId) => {
  if (isDemo) {
    setStatus('Demo mode: scanner is disabled for static preview.', 'warn');
    return;
  }

  const input = document.getElementById(targetInputId);
  if (!input) return;

  if (!('BarcodeDetector' in window)) {
    setStatus('QR scanner is not available in this browser runtime.', 'warn');
    return;
  }

  const overlay = document.getElementById('scanner');
  const video = document.getElementById('scannerVideo');
  if (!overlay || !video) return;

  try {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    state.scanner = { detector, stream, raf: 0, running: true };

    const tick = async () => {
      if (!state.scanner?.running) return;
      try {
        const entries = await detector.detect(video);
        const code = entries?.[0]?.rawValue;
        if (code) {
          input.value = String(code).trim();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          stopScanner();
          setStatus('QR detected and inserted into destination address.', '');
          return;
        }
      } catch (_err) {}
      state.scanner.raf = requestAnimationFrame(tick);
    };

    state.scanner.raf = requestAnimationFrame(tick);
  } catch (err) {
    stopScanner();
    setStatus(err.message || 'Unable to start scanner', 'error');
  }
};

const bindDemoInteractions = () => {
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      setStatus('Demo mode: actions are disabled in screenshot preview.', 'warn');
    });
  });

  ['refreshBtn', 'lockBtn', 'copyAddressBtn', 'quoteBtn', 'scanToBtn', 'scannerCloseBtn'].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('click', (event) => {
      event.preventDefault();
      if (id === 'copyAddressBtn') {
        setStatus('Demo mode: copy simulated.', '');
      } else {
        setStatus('Demo mode: interactive commands are disabled.', 'warn');
      }
    });
  });
};

const bindOnboarding = () => {
  const createForm = document.getElementById('createForm');
  const importForm = document.getElementById('importForm');

  if (createForm) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const passphrase = document.getElementById('createPassphrase').value;
        const passphrase2 = document.getElementById('createPassphrase2').value;
        const mnemonic = document.getElementById('createMnemonic').value.trim();
        if (passphrase !== passphrase2) throw new Error('Passphrase confirmation does not match');

        await api('/wallet/create', 'POST', { passphrase, mnemonic: mnemonic || null });
        await callSecureInput(false);
        setStatus('Wallet created and unlocked.', '');
        await refresh();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }

  if (importForm) {
    importForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const passphrase = document.getElementById('importPassphrase').value;
        const passphrase2 = document.getElementById('importPassphrase2').value;
        const mnemonic = document.getElementById('importMnemonic').value.trim();
        if (passphrase !== passphrase2) throw new Error('Passphrase confirmation does not match');
        if (!mnemonic) throw new Error('Mnemonic is required');

        await api('/wallet/import', 'POST', { passphrase, mnemonic });
        await callSecureInput(false);
        setStatus('Wallet imported and unlocked.', '');
        await refresh();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }
};

const bindLocked = () => {
  const unlockForm = document.getElementById('unlockForm');
  if (!unlockForm) return;

  unlockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const passphrase = document.getElementById('unlockPassphrase').value;
      await api('/wallet/unlock', 'POST', { passphrase });
      await callSecureInput(false);
      setStatus('Wallet unlocked.', '');
      await refresh();
    } catch (err) {
      setStatus(err.message, 'error');
    }
  });
};

const bindDashboard = () => {
  const refreshBtn = document.getElementById('refreshBtn');
  const lockBtn = document.getElementById('lockBtn');
  const copyAddressBtn = document.getElementById('copyAddressBtn');
  const sendForm = document.getElementById('sendForm');
  const quoteBtn = document.getElementById('quoteBtn');
  const swapForm = document.getElementById('swapForm');
  const scanToBtn = document.getElementById('scanToBtn');
  const scannerCloseBtn = document.getElementById('scannerCloseBtn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        await refresh();
        setStatus('State refreshed.', '');
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
      try {
        await api('/wallet/lock', 'POST', {});
        stopScanner();
        setStatus('Wallet locked.', 'warn');
        await refresh();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }

  if (copyAddressBtn) {
    copyAddressBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(state.remote?.address || '');
        setStatus('Address copied to clipboard.', '');
      } catch (_err) {
        setStatus('Clipboard write failed', 'error');
      }
    });
  }

  if (scanToBtn) {
    scanToBtn.addEventListener('click', async () => {
      await startScanner('sendTo');
    });
  }

  if (scannerCloseBtn) {
    scannerCloseBtn.addEventListener('click', () => stopScanner());
  }

  if (sendForm) {
    sendForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/send', 'POST', {
          to: document.getElementById('sendTo').value.trim(),
          asset: document.getElementById('sendAsset').value,
          amount: document.getElementById('sendAmount').value,
          memo: document.getElementById('sendMemo').value.trim()
        });
        setStatus('Send command accepted by local bridge.', '');
        await refresh();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }

  if (quoteBtn) {
    quoteBtn.addEventListener('click', async () => {
      try {
        const quotePayload = await api('/swap/quote', 'POST', {
          fromAsset: document.getElementById('swapFrom').value,
          toAsset: document.getElementById('swapTo').value,
          amount: document.getElementById('swapAmount').value
        });
        state.quote = quotePayload.quote;
        setStatus('Swap quote loaded.', '');
        render();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }

  if (swapForm) {
    swapForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/swap/execute', 'POST', {
          fromAsset: document.getElementById('swapFrom').value,
          toAsset: document.getElementById('swapTo').value,
          amount: document.getElementById('swapAmount').value
        });
        state.quote = null;
        setStatus('Swap executed in local state machine.', '');
        await refresh();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  }
};

const bindHardening = () => {
  window.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    const blocked =
      key === 'f12' ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key));
    if (blocked && state.secureInput) event.preventDefault();
  });
};

function render() {
  if (!state.remote) {
    app.innerHTML = `<main class="shell">${heading()}<div class="status warn">Connecting to ${esc(apiBase)}...</div></main>`;
    return;
  }

  let body = '';
  if (!state.remote.hasVault) body = onboardingView();
  else if (state.remote.locked) body = lockedView();
  else body = dashboardView();

  app.innerHTML = `<main class="shell">${body}</main>`;
  attachDraft();
  attachSecureInputs();

  if (isDemo) {
    bindDemoInteractions();
    return;
  }

  if (!state.remote.hasVault) bindOnboarding();
  else if (state.remote.locked) bindLocked();
  else bindDashboard();
}

const boot = async () => {
  bindHardening();
  render();

  if (isDemo) {
    const mode = ['onboarding', 'locked', 'dashboard'].includes(demoMode) ? demoMode : 'dashboard';
    const demo = buildDemoState(mode);
    state.remote = demo.remote;
    state.addressQr = demo.addressQr;
    state.activity = demo.activity;
    state.quote = demo.quote;
    state.status = demo.status;
    await wait(50);
    render();
    return;
  }

  try {
    await refresh();
  } catch (err) {
    state.remote = {
      hasVault: false,
      locked: true,
      address: null,
      balances: null,
      lockReason: 'bridge-offline',
      autoLockSeconds: 0
    };
    setStatus(`Bridge not reachable at ${apiBase}: ${err.message}`, 'error');
  }
};

window.addEventListener('beforeunload', () => {
  stopScanner();
  callSecureInput(false);
});

boot();
