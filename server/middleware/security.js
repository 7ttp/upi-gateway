import config from '../config/index.js';
import logger from '../utils/logger.js';

export const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  
  if (config.security.allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

export const apiSecurityMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  const allowed = config.security.allowedOrigins.some(domain =>
    (origin && origin.startsWith(domain)) ||
    (referer && referer.startsWith(domain))
  );

  if (!allowed) {
    logger.warn(`Unauthorized API access attempt from: ${origin || referer || 'unknown'}`);
    return res.status(403).json({ 
      error: 'Forbidden: API access is only allowed from authorized domains' 
    });
  }

  next();
};

export const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress;
};
