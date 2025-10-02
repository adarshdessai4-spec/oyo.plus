require('dotenv').config();

const express = require('express');
const axios = require('axios'); // reserved for future provider calls
const crypto = require('crypto');
const path = require('path');
const propertyCatalog = require('./data/properties.json').properties;

const PORT = Number(process.env.PORT) || 8080;
const BOOKING_TAX_RATE = 0.12;
const BOOKING_SERVICE_FEE = 299;

const db = {
  orders: {},
  transfers: {},
  idempotency: {},
  bookings: {},
  forms: {
    promo: [],
    corporate: [],
    support: [],
  },
};

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ type: ['application/json', 'application/*+json'] }));

// Basic cache headers for static assets
app.use((req, res, next) => {
  if (req.method === 'GET' && /\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});
app.use(express.static(__dirname));

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const HOTEL_LINKED_ACCOUNT_ID = process.env.HOTEL_LINKED_ACCOUNT_ID;
const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT || 0);

function generateId(prefix = 'ID') {
  const randomSegment = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomSegment}`;
}

function verifyWebhook(payload, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured');
    return false;
  }
  const generated = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
}

async function createTransfer(paymentId, amountPaise) {
  const url = `https://api.razorpay.com/v1/payments/${paymentId}/transfers`;
  const response = await axios.post(
    url,
    {
      transfers: [
        {
          account: HOTEL_LINKED_ACCOUNT_ID,
          amount: amountPaise,
          currency: 'INR',
          on_hold: true,
        },
      ],
    },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    },
  );
  return response.data?.items?.[0];
}

async function createRefund(paymentId, amountPaise, reason, reverseAll = false) {
  const url = `https://api.razorpay.com/v1/payments/${paymentId}/refund`;
  const response = await axios.post(
    url,
    {
      amount: amountPaise,
      reverse_all: reverseAll,
      speed: 'normal',
      notes: { reason },
    },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    },
  );
  return response.data;
}

async function reverseTransfer(transferId, amountPaise) {
  const url = `https://api.razorpay.com/v1/transfers/${transferId}/reversals`;
  const response = await axios.post(
    url,
    { amount: amountPaise },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    },
  );
  return response.data;
}

async function releaseHold(transferId) {
  const url = `https://api.razorpay.com/v1/transfers/${transferId}`;
  const response = await axios.patch(
    url,
    { on_hold: false },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    },
  );
  return response.data;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/webhooks/razorpay', async (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-razorpay-signature'];
  if (!signature || !verifyWebhook(payload, signature)) {
    console.warn('Invalid razorpay signature');
    return res.status(400).json({ ok: false, error: 'invalid_signature' });
  }

  try {
    const event = req.body;
    console.log('Webhook received:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const amount = Number(payment.amount);
      const notes = payment.notes || {};
      const orderId = notes.order_id || payment.order_id || payment.id;
      const platformFee = Math.round((amount * PLATFORM_FEE_PCT) / 100);
      const hotelShare = amount - platformFee;

      const transfer = await createTransfer(payment.id, hotelShare);

      db.orders[orderId] = db.orders[orderId] || {
        id: orderId,
        payments: [],
        transfers: [],
        vendorBalance: 0,
        amountPaid: 0,
        platformFee,
      };
      db.orders[orderId].payments.push({
        id: payment.id,
        amount,
        status: payment.status,
      });
      db.orders[orderId].transfers.push({
        id: transfer.id,
        amount: hotelShare,
        on_hold: transfer.on_hold,
      });
      db.orders[orderId].amountPaid += amount;
      db.transfers[transfer.id] = {
        orderId,
        paymentId: payment.id,
        amount: hotelShare,
      };

      console.log('Processed payment.captured', {
        orderId,
        paymentId: payment.id,
        transferId: transfer.id,
        hotelShare,
        platformFee,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Webhook processing error', error);
    res.status(500).json({ ok: false });
  }
});

app.get('/orders/:id', (req, res) => {
  const order = db.orders[req.params.id];
  if (!order) {
    return res.status(404).json({ ok: false, error: 'order_not_found' });
  }
  res.json({ ok: true, order });
});

app.post('/api/bookings', (req, res) => {
  const { propertyId, checkIn, nights, guests, guest, requests } = req.body || {};
  const guestName = guest?.name ? String(guest.name).trim() : '';
  const guestEmail = guest?.email ? String(guest.email).trim() : '';
  const guestPhone = guest?.phone ? String(guest.phone).trim() : '';
  const notes = typeof requests === 'string' ? requests.trim() : '';

  if (!propertyId || !checkIn || !nights || !guests || !guestName || !guestEmail) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  const property = propertyCatalog.find((item) => item.id === propertyId);
  if (!property) {
    return res.status(404).json({ ok: false, error: 'property_not_found' });
  }

  const nightsCount = Math.max(1, Number(nights) || 1);
  const guestsCount = Math.max(1, Number(guests) || 1);
  if (guestsCount > (property.maxGuests || guestsCount)) {
    return res.status(400).json({ ok: false, error: 'guests_exceed' });
  }

  const checkInDate = new Date(checkIn);
  if (Number.isNaN(checkInDate.getTime())) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + nightsCount);

  const nightlyRate = Number(property.price) || 0;
  const subtotal = nightlyRate * nightsCount;
  const tax = Math.round(subtotal * BOOKING_TAX_RATE);
  const fees = BOOKING_SERVICE_FEE;
  const total = subtotal + tax + fees;

  const bookingId = generateId('BKG');
  const reservation = {
    id: bookingId,
    propertyId,
    propertyName: property.name,
    city: property.city,
    area: property.area ?? '',
    nightlyRate,
    currency: property.currency || 'INR',
    checkIn: checkInDate.toISOString(),
    checkOut: checkOutDate.toISOString(),
    nights: nightsCount,
    guests: guestsCount,
    subtotal,
    tax,
    fees,
    total,
    status: 'reserved',
    guest: {
      name: guestName,
      email: guestEmail,
      phone: guestPhone,
    },
    requests: notes,
    createdAt: new Date().toISOString(),
    propertyImage: property.images?.[0]?.src ?? null,
  };

  db.bookings[bookingId] = reservation;
  db.orders[bookingId] = {
    id: bookingId,
    propertyId,
    propertyName: property.name,
    city: property.city,
    amountPaid: 0,
    amountDue: total,
    currency: reservation.currency,
    nights: nightsCount,
    guests: guestsCount,
    status: 'reserved',
    payments: [],
    transfers: [],
    vendorBalance: 0,
    platformFee: Math.round((total * PLATFORM_FEE_PCT) / 100),
    customer: reservation.guest,
    meta: {
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      requests: reservation.requests,
    },
  };

  console.log('Booking created', {
    bookingId,
    propertyId,
    checkIn: reservation.checkIn,
    guests: guestsCount,
  });

  res.status(201).json({ ok: true, booking: reservation });
});

app.post('/api/promo-subscriptions', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ ok: false, error: 'missing_email' });
  }
  db.forms.promo.push({ email, created_at: Date.now() });
  console.log('Promo subscription stored', email);
  res.json({ ok: true });
});

app.post('/api/corporate-enquiries', (req, res) => {
  const payload = req.body || {};
  if (!payload.company || !payload.email) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  db.forms.corporate.push({ ...payload, created_at: Date.now() });
  console.log('Corporate enquiry stored', payload.company, payload.email);
  res.json({ ok: true });
});

app.post('/api/support-requests', (req, res) => {
  const payload = req.body || {};
  if (!payload.subject || !payload.email) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  db.forms.support.push({ ...payload, created_at: Date.now() });
  console.log('Support request stored', payload.subject, payload.email);
  res.json({ ok: true });
});

app.post('/refunds', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (idempotencyKey && db.idempotency[idempotencyKey]) {
    return res.json(db.idempotency[idempotencyKey]);
  }

  const { order_id: orderId, amount, reason } = req.body || {};
  if (!orderId || !amount) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  const order = db.orders[orderId];
  if (!order || !order.payments || order.payments.length === 0) {
    return res.status(404).json({ ok: false, error: 'order_not_found' });
  }

  const payment = order.payments[0];
  const totalPaid = payment.amount;
  let responsePayload = { ok: true };

  try {
    if (amount === totalPaid && order.transfers.length === 1) {
      const refund = await createRefund(payment.id, amount, reason || 'full_refund', true);
      responsePayload.refund_id = refund.id;
      console.log('Full refund processed with reverse_all', { orderId, refundId: refund.id });
    } else {
      const transfer = order.transfers[0];
      let reversal;
      try {
        reversal = await reverseTransfer(transfer.id, amount);
      } catch (err) {
        console.error('Transfer reversal failed, recording negative balance', err.response?.data || err.message);
        order.vendorBalance = (order.vendorBalance || 0) - amount;
      }
      const refund = await createRefund(payment.id, amount, reason || 'partial_refund', false);
      responsePayload = {
        ok: true,
        refund_id: refund.id,
        reversed_transfer_id: reversal?.id,
      };
      console.log('Partial refund processed', {
        orderId,
        refundId: refund.id,
        reversalId: reversal?.id,
      });
    }

    if (idempotencyKey) {
      db.idempotency[idempotencyKey] = responsePayload;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Refund processing error', error.response?.data || error.message);
    res.status(500).json({ ok: false, error: 'refund_failed' });
  }
});

app.post('/settlements/release', async (req, res) => {
  const { order_id: orderId } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ ok: false, error: 'missing_order_id' });
  }

  const order = db.orders[orderId];
  if (!order || !order.transfers || order.transfers.length === 0) {
    return res.status(404).json({ ok: false, error: 'order_not_found' });
  }

  try {
    const transfer = order.transfers[0];
    const result = await releaseHold(transfer.id);
    transfer.on_hold = result.on_hold;
    console.log('Released transfer hold', { orderId, transferId: transfer.id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Release hold error', error.response?.data || error.message);
    res.status(500).json({ ok: false, error: 'release_failed' });
  }
});

const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  const banner = [
    '🚀 OYO.plus settlement service ready',
    `Port          : ${PORT}`,
    `Platform fee  : ${process.env.PLATFORM_FEE_PCT || 'n/a'}%`,
    `Hotel account : ${process.env.HOTEL_LINKED_ACCOUNT_ID || 'not-set'}`,
  ].join('\n');
  console.log(banner);
});

server.on('error', (err) => {
  console.error('Server failed to start', err);
  process.exit(1);
});

console.log(`
=== Razorpay Route README ===
Setup
  cp .env.example .env   # fill keys + HOTEL_LINKED_ACCOUNT_ID
  npm i
  npm start

Register webhook on Razorpay Dashboard pointing to https://<your-ngrok>/webhooks/razorpay with events: payment.captured, refund.*, transfer.*, reversal.*.

Live test (₹2–₹10) with your two Axis accounts
1) Take payment via Checkout (UPI).
2) Wait for payment.captured → the server will create a transfer on HOLD to the hotel linked account (Axis B).
3) Full pre-settlement refund:
   curl -X POST http://localhost:8080/refunds \
     -H 'Content-Type: application/json' \
     -d '{"order_id":"O123","amount":1000,"reason":"customer_cancel"}'
   Expect: refund issued + transfer auto-reversed (reverse_all=true).
4) Partial pre-settlement refund (₹3): same call with amount:300; the server will reverse ₹3 on the transfer, then refund ₹3.
5) Post-settlement refund:
   Call /settlements/release to release hold and let it settle to Axis B.
   Then call /refunds → server attempts reversal; if insufficient float, it still refunds and notes negative vendor balance.

Debug
  curl http://localhost:8080/orders/O123
================================
`);

module.exports = { app, db, axios, crypto };

/* SPA fallback */
app.get('*', (req, res) => {
  // If it looks like an API request, 404
  if (req.path.startsWith('/api/') || req.path.startsWith('/orders') || req.path.startsWith('/refunds') || req.path.startsWith('/transfers') || req.path.startsWith('/settlements')) {
    return res.status(404).json({ ok:false, error:'not_found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});
