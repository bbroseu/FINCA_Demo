const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// CONFIGURATION — loaded from environment variables
// ============================================================
const CONFIG = {
  clientId: process.env.PAYMENT_CLIENT_ID || '530000082',
  storeKey: process.env.PAYMENT_STORE_KEY || 'DEMO_STORE_KEY',
  storeType: '3D_Pay_Hosting',
  currency: '978',           // EUR
  gateUrl: process.env.PAYMENT_GATE_URL || 'https://torus-stage-bktkosova.asseco-see.com.tr/fim/est3Dgate',
  okUrl: process.env.PAYMENT_OK_URL || 'https://localhost:3000/api/payment/response',
  failUrl: process.env.PAYMENT_FAIL_URL || 'https://localhost:3000/api/payment/response',
  callbackUrl: process.env.PAYMENT_CALLBACK_URL || 'https://localhost:3000/api/payment/callback',
  lang: 'en',
  hashAlgorithm: 'ver3',
  encoding: 'UTF-8',
};

// ============================================================
// HASH V3 CALCULATION
// ============================================================
function escapeValue(val) {
  return String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function calculateHashV3(params, storeKey) {
  const keys = Object.keys(params).filter(
    (k) => k.toLowerCase() !== 'hash' && k.toLowerCase() !== 'encoding'
  );

  keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let plaintext = keys.map((k) => escapeValue(params[k])).join('|');
  plaintext += '|' + escapeValue(storeKey);

  const hash = crypto.createHash('sha512').update(plaintext, 'utf8').digest('base64');
  return hash;
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderResult({ success, message, params }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payment ${success ? 'Success' : 'Failed'}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
        .result { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .failure { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 4px 8px; border-bottom: 1px solid #eee; word-break: break-all; }
        td:first-child { font-weight: 600; white-space: nowrap; width: 180px; }
      </style>
    </head>
    <body>
      <div class="result ${success ? 'success' : 'failure'}">
        <h2>${success ? '✓ Payment Successful' : '✗ Payment Failed'}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <h3>Response Parameters</h3>
      <table>
        ${Object.entries(params)
          .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
          .join('\n')}
      </table>
    </body>
    </html>
  `;
}

// ============================================================
// SERVICE METHODS
// ============================================================
class PaymentService {

  validatePaymentParams(amount, orderId) {
    if (!amount || !orderId) {
      throw new Error('Missing required params: amount, orderId');
    }
  }

  buildPaymentParams(amount, orderId) {
    return {
      clientid: CONFIG.clientId,
      amount: amount,
      oid: orderId,
      okurl: CONFIG.okUrl,
      failUrl: CONFIG.failUrl,
      TranType: 'Auth',
      Instalment: '',
      callbackUrl: CONFIG.callbackUrl,
      currency: CONFIG.currency,
      rnd: Date.now().toString(),
      storetype: CONFIG.storeType,
      hashAlgorithm: CONFIG.hashAlgorithm,
      lang: CONFIG.lang,
      encoding: CONFIG.encoding,
    };
  }

 generatePaymentForm(amount, orderId) {
  this.validatePaymentParams(amount, orderId);
  const params = this.buildPaymentParams(amount, orderId);
  const hash = calculateHashV3(params, CONFIG.storeKey);

  const hiddenFields = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}" />`)
    .join('\n      ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redirecting to payment...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f0f2f5;
          color: #1a1a2e;
        }

        .card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          padding: 48px 40px;
          max-width: 420px;
          width: 90%;
          text-align: center;
        }

        .icon {
          width: 56px;
          height: 56px;
          background: #e8f0fe;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          font-size: 24px;
        }

        h1 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .subtitle {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        .amount {
          font-size: 32px;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 8px;
        }

        .order-id {
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 32px;
        }

        .btn {
          display: inline-block;
          width: 100%;
          padding: 14px 24px;
          font-size: 16px;
          font-weight: 600;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .btn:hover { background: #1d4ed8; }

        .countdown {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 16px;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #d1d5db;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          vertical-align: middle;
          margin-right: 6px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h1>Secure Payment</h1>
        <p class="subtitle">You will be redirected to the secure payment gateway</p>
        <div class="amount">${escapeHtml(amount)}</div>
        <div class="order-id">Order #${escapeHtml(orderId)}</div>

        <form id="payForm" method="POST" action="${CONFIG.gateUrl}" enctype="application/x-www-form-urlencoded">
          ${hiddenFields}
          <input type="hidden" name="HASH" value="${hash}" />
          <button type="submit" class="btn">Continue to Payment</button>
        </form>

        <p class="countdown">
          <span class="spinner"></span>
          Auto-redirecting in <span id="timer">3</span>s
        </p>
      </div>

      <script>
        const form = document.getElementById('payForm');
        let seconds = 3;
        const timerEl = document.getElementById('timer');

        const interval = setInterval(() => {
          seconds--;
          timerEl.textContent = seconds;
          if (seconds <= 0) {
            clearInterval(interval);
            form.submit();
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
}

  verifyHash(params) {
    const receivedHash = params.HASH || params.hash;
    if (!receivedHash) {
      return { valid: false, error: 'No HASH in response' };
    }

    const calculatedHash = calculateHashV3(params, CONFIG.storeKey);

    if (receivedHash !== calculatedHash) {
      return {
        valid: false,
        error: 'HASH MISMATCH',
        details: { received: receivedHash, calculated: calculatedHash }
      };
    }

    return { valid: true };
  }

  processPaymentResponse(params) {
    console.log('--- PAYMENT RESPONSE ---');
    console.log(JSON.stringify(params, null, 2));

    const hashVerification = this.verifyHash(params);

    if (!hashVerification.valid) {
      console.error(hashVerification.error);
      if (hashVerification.details) {
        console.error('Received:', hashVerification.details.received);
        console.error('Calculated:', hashVerification.details.calculated);
      }

      return {
        success: false,
        message: 'Security Alert: Digital signature verification failed.',
        html: renderResult({
          success: false,
          message: 'Security Alert: Digital signature verification failed.',
          params,
        })
      };
    }

    const mdStatus = params.mdStatus;
    const procReturnCode = params.ProcReturnCode;
    const response = params.Response;
    const errMsg = params.ErrMsg || params.EXTRA_CARDERROR_MSG || '';

    const isHashValid = true;
    const is3DSecure = ['1', '2', '3', '4'].includes(mdStatus);
    const isApproved = procReturnCode === '00' && response === 'Approved';
    const success = isHashValid && is3DSecure && isApproved;

    console.log(`Hash: VALID | mdStatus: ${mdStatus} | ProcReturnCode: ${procReturnCode} | Response: ${response}`);

    const message = success
      ? `Payment approved. Order: ${params.oid || 'N/A'}`
      : `Payment failed. ${errMsg} (mdStatus=${mdStatus}, ProcReturnCode=${procReturnCode})`;

    return {
      success,
      message,
      html: renderResult({ success, message, params })
    };
  }

  processCallback(params) {
    console.log('--- SERVER CALLBACK ---');
    console.log(JSON.stringify(params, null, 2));

    const hashVerification = this.verifyHash(params);

    if (!hashVerification.valid) {
      console.error('CALLBACK HASH MISMATCH');
      return { success: false, error: 'HASH_MISMATCH' };
    }

    const procReturnCode = params.ProcReturnCode;
    const response = params.Response;
    const mdStatus = params.mdStatus;

    if (procReturnCode === '00' && response === 'Approved') {
      console.log(`CALLBACK: Order ${params.oid} APPROVED`);
      return { success: true, orderId: params.oid, status: 'APPROVED' };
    } else {
      console.log(`CALLBACK: Order ${params.oid} FAILED (${procReturnCode})`);
      return { success: false, orderId: params.oid, status: 'FAILED', code: procReturnCode };
    }
  }
}

module.exports = new PaymentService();