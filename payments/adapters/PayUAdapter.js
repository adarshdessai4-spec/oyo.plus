const BaseAdapter = require('./BaseAdapter');

class PayUAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = config.client;
  }

  async createSplitSettlement(booking) {
    const splitData = booking.splits.map((split) => ({
      merchantId: split.destinationAccount,
      amount: split.amount,
      description: split.notes,
      commission: split.commission,
    }));

    const response = await this.client.splitSettlement.create({
      merchantTransactionId: booking.id,
      amount: booking.totalAmount,
      currency: booking.currency,
      splitInfo: splitData,
    });

    return {
      settlementId: response.transactionId,
      provider: 'payu',
      raw: response,
    };
  }

  async holdFunds(settlementId, options = {}) {
    return this.client.splitSettlement.hold({
      transactionId: settlementId,
      releaseDate: options.holdUntil,
    });
  }

  async releaseFunds(settlementId) {
    return this.client.splitSettlement.release({ transactionId: settlementId });
  }

  async refund(settlementId, amount) {
    return this.client.splitSettlement.refund({
      transactionId: settlementId,
      amount,
      reverseSplits: true,
    });
  }

  async fetchReport(filters = {}) {
    return this.client.splitSettlement.reports(filters);
  }
}

module.exports = PayUAdapter;
