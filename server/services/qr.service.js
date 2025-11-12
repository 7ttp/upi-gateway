import QRCode from 'qrcode';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class QRService {
  generateUPIString(amount, transactionNote) {
    const { id, payeeName } = config.upi;
    
    if (!id) {
      throw new Error('UPI ID not configured');
    }

    const params = new URLSearchParams({
      pa: id,
      pn: payeeName,
      am: amount.toString(),
      cu: 'INR',
    });

    if (transactionNote) {
      params.append('tn', transactionNote);
    }

    return `upi://pay?${params.toString()}`;
  }

  async generateQRCode(upiString) {
    try {
      const qrDataURL = await QRCode.toDataURL(upiString, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 512,
      });

      logger.info('QR code generated successfully');
      return qrDataURL;
    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw error;
    }
  }

  async generatePaymentQR(amount, transactionNote) {
    const upiString = this.generateUPIString(amount, transactionNote);
    const qrCode = await this.generateQRCode(upiString);

    return {
      upiString,
      qrCode,
      upiId: config.upi.id,
      payeeName: config.upi.payeeName,
    };
  }
}

export default new QRService();
