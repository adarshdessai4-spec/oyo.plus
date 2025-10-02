const PaymentService = require('./PaymentService');

// Example factory that picks provider configuration dynamically
function createPaymentService(provider = process.env.PAYMENT_PROVIDER || 'razorpay') {
  const providerConfig = getProviderConfig(provider);
  return new PaymentService({
    provider,
    config: providerConfig,
    commissionRules: getCommissionRule,
  });
}

function getProviderConfig(provider) {
  switch (provider) {
    case 'razorpay':
      return {
        client: require('razorpay')({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        }),
      };
    case 'cashfree':
      return {
        client: {
          easySplit: require('cashfree-sdk').EasySplit({
            clientId: process.env.CASHFREE_CLIENT_ID,
            clientSecret: process.env.CASHFREE_CLIENT_SECRET,
          }),
        },
      };
    case 'payu':
      return {
        client: require('payu-sdk')({
          key: process.env.PAYU_KEY,
          salt: process.env.PAYU_SALT,
          environment: process.env.PAYU_ENV || 'TEST',
        }),
      };
    default:
      throw new Error(`Unsupported provider config: ${provider}`);
  }
}

function getCommissionRule(hotelId) {
  const table = {
    DELUXE01: { platformPercent: 0.12 },
    PREMIUM_VILLA: { platformPercent: 0.15, fixedFee: 19900 },
  };
  return table[hotelId] || { platformPercent: 0.1 };
}

module.exports = { createPaymentService };
