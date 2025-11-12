import fetch from 'node-fetch';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class PaymentService {
  async fetchBalance() {
    try {
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'authorization': config.mobikwik.auth,
        'origin': 'https://www.mobikwik.com',
        'referer': 'https://www.mobikwik.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-mclient': '0',
      };

      const response = await fetch(config.mobikwik.apiUrl, { headers });
      const data = await response.json();

      if (!data.success || typeof data.data.balance !== 'number') {
        throw new Error('Invalid balance response');
      }

      return parseFloat(data.data.balance);
    } catch (error) {
      logger.error('Failed to fetch balance:', error);
      throw error;
    }
  }

  calculateAmount(basePrice, couponCode, tax) {
    let finalPrice = basePrice;
    let appliedCoupon = null;
    
    const code = (couponCode || '').trim().toLowerCase();
    
    if (code.length > 0) {
      appliedCoupon = code;
    }
    
    const taxValue = parseFloat(tax);
    if (isNaN(taxValue) || taxValue < 0) {
      throw new Error('Invalid tax value');
    }

    return {
      finalPrice,
      taxValue,
      totalAmount: parseFloat((finalPrice + taxValue).toFixed(2)),
      appliedCoupon,
    };
  }

  validatePayment(initialBalance, currentBalance, expectedAmount) {
    const diff = parseFloat((currentBalance - initialBalance).toFixed(2));
    const expected = parseFloat(expectedAmount.toFixed(2));
    
    return {
      isValid: diff === expected,
      diff,
      expected,
    };
  }
}

export default new PaymentService();
