class BaseAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  async createSplitSettlement(/* booking */) {
    throw new Error('createSplitSettlement must be implemented by adapter');
  }

  async holdFunds(/* settlementId, options */) {
    throw new Error('holdFunds must be implemented by adapter');
  }

  async releaseFunds(/* settlementId */) {
    throw new Error('releaseFunds must be implemented by adapter');
  }

  async refund(/* settlementId, amount */) {
    throw new Error('refund must be implemented by adapter');
  }

  async fetchReport(/* filters */) {
    throw new Error('fetchReport must be implemented by adapter');
  }
}

module.exports = BaseAdapter;
