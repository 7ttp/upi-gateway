import crypto from 'crypto';
import databaseService from '../services/database.service.js';
import logger from '../utils/logger.js';

class NonceService {
  generateNonce() {
    return crypto.randomBytes(32).toString('hex');
  }

  async createNonce(ip, userAgent) {
    const db = databaseService.getDb();
    const nonce = this.generateNonce();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection('nonces').insertOne({
      nonce,
      expiresAt,
      used: false,
      createdAt: new Date(),
      ip,
      userAgent,
    });

    logger.info(`Nonce created: ${nonce}`);
    return nonce;
  }

  async validateAndConsumeNonce(nonce) {
    const db = databaseService.getDb();
    const nonceDoc = await db.collection('nonces').findOne({ nonce });

    if (!nonceDoc) {
      throw new Error('Invalid nonce');
    }

    if (nonceDoc.used) {
      throw new Error('Nonce already used');
    }

    if (new Date() > nonceDoc.expiresAt) {
      await db.collection('nonces').deleteOne({ nonce });
      throw new Error('Nonce expired');
    }

    await db.collection('nonces').deleteOne({ nonce });
    logger.info(`Nonce consumed: ${nonce}`);
    
    return true;
  }
}

export default new NonceService();
