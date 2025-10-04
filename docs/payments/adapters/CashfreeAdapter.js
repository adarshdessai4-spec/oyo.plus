const BaseAdapter = require('./BaseAdapter');

class CashfreeAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = config.client;
  }

  async createSplitSettlement(booking) {
    const splitInstructions = booking.splits.map((split) => ({
      beneId: split.destinationAccount,
      amount: split.amount,
      percentage: split.percentage,
      remarks: split.notes,
    }));

    const response = await this.client.easySplit.createOrder({
      orderId: booking.id,
      orderAmount: booking.totalAmount,
      orderCurrency: booking.currency,
      customerDetails: booking.customer,
      splitPayout: splitInstructions,
    });

    return {
      settlementId: response.orderId,
      provider: 'cashfree',
      raw: response,
    };
  }

  async holdFunds(settlementId, options = {}) {
    return this.client.easySplit.hold({
      orderId: settlementId,
      hold: true,
      releaseAfter: options.holdUntil,
    });
  }

  async releaseFunds(settlementId) {
    return this.client.easySplit.release({ orderId: settlementId });
  }

  async refund(settlementId, amount) {
    return this.client.easySplit.refund({
      orderId: settlementId,
      refundAmount: amount,
      splitRefund: true,
    });
  }

  async fetchReport(filters = {}) {
    return this.client.easySplit.settlements(filters);
  }
}

module.exports = CashfreeAdapter;
