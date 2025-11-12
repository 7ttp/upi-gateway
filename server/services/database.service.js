import { MongoClient } from 'mongodb';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.mongodb.uri);
      await this.client.connect();
      this.db = this.client.db(config.mongodb.dbName);
      
      await this.createIndexes();
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      throw error;
    }
  }

  async createIndexes() {
    await this.db.collection('nonces').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
    
    await this.db.collection('payment_sessions').createIndex({ orderId: 1 });
    await this.db.collection('payment_sessions').createIndex({ status: 1 });
    await this.db.collection('payment_sessions').createIndex({ createdAt: -1 });
    
    await this.db.collection('orders').createIndex({ orderId: 1 }, { unique: true });
    await this.db.collection('orders').createIndex({ email: 1 });
    
    logger.info('Database indexes created successfully');
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      logger.info('Disconnected from MongoDB');
    }
  }
}

export default new DatabaseService();
