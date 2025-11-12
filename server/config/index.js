import 'dotenv/config';

export default {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/upi_gateway',
    dbName: process.env.MONGODB_DB_NAME || 'upi_gateway',
  },
  
  mobikwik: {
    auth: process.env.MOBIKWIK_AUTH,
    apiUrl: process.env.MOBIKWIK_API_URL || 'https://webapi.mobikwik.com/p/wallet/balance',
  },
  
  upi: {
    id: process.env.UPI_ID,
    payeeName: process.env.UPI_PAYEE_NAME || 'Payment Gateway',
  },
  
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    adminSecret: process.env.ADMIN_SECRET,
  },
  
  session: {
    expiryMinutes: parseInt(process.env.SESSION_EXPIRY_MINUTES || '10'),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '600000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5'),
  },
};
