const BaseAdapter = require('./BaseAdapter');

class RazorpayAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = config.client;
  }

  async createSplitSettlement(booking) {
    const transfers = booking.splits.map((split) => ({
      account: split.destinationAccount,
      amount: split.amount,
      currency: booking.currency,
      on_hold: true,
      notes: split.notes,
    }));

    const response = await this.client.orders.create({
      amount: booking.totalAmount,
      currency: booking.currency,
      receipt: booking.id,
      transfers,
    });

    return {
      settlementId: response.id,
      provider: 'razorpay',
      raw: response,
    };
  }

  async holdFunds(settlementId, options = {}) {
    return this.client.orders.updateTransfer({
      order_id: settlementId,
      on_hold: true,
      on_hold_until: options.holdUntil,
    });
  }

  async releaseFunds(settlementId) {
    return this.client.orders.updateTransfer({
      order_id: settlementId,
      on_hold: false,
    });
  }

  async refund(settlementId, amount) {
    return this.client.payments.refund({
      payment_id: settlementId,
      amount,
      reverse_all: true,
    });
  }

  async fetchReport(filters = {}) {
    return this.client.transfers.all(filters);
  }
}

module.exports = RazorpayAdapter;
