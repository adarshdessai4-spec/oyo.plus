const RazorpayAdapter = require('./adapters/RazorpayAdapter');
const CashfreeAdapter = require('./adapters/CashfreeAdapter');
const PayUAdapter = require('./adapters/PayUAdapter');

const PROVIDERS = {
  razorpay: RazorpayAdapter,
  cashfree: CashfreeAdapter,
  payu: PayUAdapter,
};

class PaymentService {
  constructor({ provider, config, commissionRules }) {
    const Adapter = PROVIDERS[provider];
    if (!Adapter) {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
    this.adapter = new Adapter(config);
    this.commissionRules = commissionRules || (() => ({ platformPercent: 0.1 }));
  }

  buildSplits(booking) {
    const { platformPercent, fixedFee = 0 } = this.commissionRules(booking.hotelId) || {};
    const platformShare = Math.round(booking.totalAmount * platformPercent + fixedFee);
    const hotelShare = booking.totalAmount - platformShare;

    return [
      {
        destinationAccount: booking.hotelAccountId,
        amount: hotelShare,
        notes: 'Hotel settlement',
        commission: { percent: 100 - platformPercent * 100 },
      },
      {
        destinationAccount: booking.platformAccountId,
        amount: platformShare,
        notes: 'OYO.plus platform fee',
        commission: { percent: platformPercent * 100 },
      },
    ];
  }

  async createBookingSettlement(booking) {
    const payload = {
      ...booking,
      splits: this.buildSplits(booking),
    };
    return this.adapter.createSplitSettlement(payload);
  }

  async holdUntilCheckIn(settlementId, checkInDate) {
    return this.adapter.holdFunds(settlementId, { holdUntil: checkInDate });
  }

  async releaseAfterCheckIn(settlementId) {
    return this.adapter.releaseFunds(settlementId);
  }

  async refundBooking(settlementId, amount) {
    return this.adapter.refund(settlementId, amount);
  }

  async downloadReport(filters) {
    return this.adapter.fetchReport(filters);
  }
}

module.exports = PaymentService;
