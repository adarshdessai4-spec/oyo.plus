# OYO.plus Web Experience

A multi-page, OYO-inspired marketing experience for OYO.plus with dynamic content pulled from local JSON feeds. The site is completely static, so you only need a lightweight HTTP server to run it locally.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 16 or newer (only needed to run the local static server)

### Install
No dependencies are required. Clone or download this directory.

### Run
```bash
node server.js
# or using the npm script
npm start
```

Then open your browser to [http://localhost:3000](http://localhost:3000).

The custom server ensures `fetch()` requests to `/data/*.json` work correctly. Opening the site directly from the filesystem (`file://`) will block those requests.

### Project Structure
- `index.html` – Home landing page (collections, search, offers)
- `listings.html` – Search results with filters
- `stay-detail.html` – Property detail view populated from `data/properties.json`
- `corporate.html`, `about.html`, `support.html` – Additional marketing/support pages
- `styles.css` – Shared styling and responsive rules
- `script.js` – Navigation handling, data fetching, filtering, UI animations
- `data/` – JSON content feeds consumed by `script.js`
- `server.js` – Lightweight Node static server
- `package.json` – npm metadata with a `start` script
- `payments/` – Pluggable marketplace auto-split payment adapters (Razorpay Route, Cashfree Easy Split, PayU Split Settlements)

## Customisation
- Update JSON files in `data/` to adjust copy, imagery, and inventory without touching markup.
- Extend the mock API with additional properties or destinations, then refresh the browser to see them reflected across pages.
- Configure marketplace split payments by selecting a provider (`razorpay`, `cashfree`, or `payu`) and supplying credentials via environment variables. The adapter architecture lives under `payments/` and can be extended for other PSPs.

### Express API (developer sandbox)
- `GET /healthz` – sanity check.
- `POST /webhooks/razorpay` – signature-verified handler for `payment.captured`, creating an on-hold hotel transfer.
- `POST /refunds` – handles full or partial refunds, reversing transfers as needed.
- `POST /settlements/release` – releases the hotel transfer hold (simulated payout).
- `POST /api/promo-subscriptions` – capture marketing opt-ins.
- `POST /api/corporate-enquiries` – stores corporate requests.
- `POST /api/support-requests` – stores support escalations.
- `POST /api/bookings` – creates a reservation hold and echoes the booking summary.
- `GET /orders/:id` – debug the in-memory booking record.

```js
const { createPaymentService } = require('./payments/config');
const paymentService = createPaymentService('razorpay');

// Example: when a booking is confirmed
const settlement = await paymentService.createBookingSettlement({
  id: 'BOOKING123',
  hotelId: 'DELUXE01',
  hotelAccountId: 'acc_hoteldeluxe',
  platformAccountId: 'acc_oyoplus',
  totalAmount: 450000, // paise
  currency: 'INR',
  customer: { name: 'Aditi', email: 'aditi@example.com' },
});

// Hold funds until guest check-in
await paymentService.holdUntilCheckIn(settlement.settlementId, '2024-07-10T10:00:00Z');

// Release after stay
await paymentService.releaseAfterCheckIn(settlement.settlementId);
```

## Production Notes
For production hosting, serve the `oyo` directory with any static host (Netlify, Vercel, S3, etc.). Ensure the host maps `/` to `index.html` and serves the `data/` directory with the correct MIME type (`application/json`).

Replace the mock alert handlers in `script.js` with real booking logic or API calls as you integrate with backend services.
