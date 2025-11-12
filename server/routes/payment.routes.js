import express from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import databaseService from '../services/database.service.js';
import paymentService from '../services/payment.service.js';
import nonceService from '../services/nonce.service.js';
import qrService from '../services/qr.service.js';
import logger from '../utils/logger.js';
import { getClientIp } from '../middleware/security.js';
import {
  validate,
  createSessionValidation,
  orderIdValidation,
  orderIdParamValidation,
} from '../middleware/validation.js';

const router = express.Router();

const sessionLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/nonce', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const nonce = await nonceService.createNonce(ip, userAgent);
    
    res.json({ nonce });
  } catch (error) {
    logger.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

router.post('/create-payment-session', 
  sessionLimiter, 
  createSessionValidation, 
  validate, 
  async (req, res) => {
    try {
      const db = databaseService.getDb();
      const { orderId, productDetails, deliveryDetails, nonce, email, couponCode, tax, basePrice } = req.body;
      const clientIp = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      await nonceService.validateAndConsumeNonce(nonce);

      const { totalAmount, appliedCoupon, taxValue } = paymentService.calculateAmount(
        basePrice,
        couponCode,
        tax
      );

      const initialBalance = await paymentService.fetchBalance();

      const paymentSession = {
        orderId,
        productDetails,
        deliveryDetails,
        email,
        totalAmount,
        basePrice,
        taxValue,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + config.session.expiryMinutes * 60 * 1000),
        initialBalance,
        finalBalance: null,
        ip: clientIp,
        userAgent,
        coupon: appliedCoupon,
      };

      await db.collection('payment_sessions').insertOne(paymentSession);

      await db.collection('logs').insertOne({
        action: 'create-payment-session',
        orderId,
        ip: clientIp,
        userAgent,
        timestamp: new Date(),
        email,
        coupon: appliedCoupon,
        initialBalance,
      });

      logger.info(`Payment session created: ${orderId}`);

      res.json({
        success: true,
        message: 'Payment session created',
        orderId,
        amount: totalAmount,
      });
    } catch (error) {
      logger.error('Create payment session error:', error);
      res.status(400).json({ error: error.message || 'Failed to create payment session' });
    }
  }
);

router.get('/payment-status/:orderId', orderIdParamValidation, validate, async (req, res) => {
  try {
    const db = databaseService.getDb();
    const { orderId } = req.params;

    const session = await db.collection('payment_sessions').findOne(
      { orderId },
      { sort: { createdAt: -1 } }
    );

    if (!session) {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    if (new Date() > session.expiresAt && session.status === 'pending') {
      await db.collection('payment_sessions').updateOne(
        { orderId },
        { $set: { status: 'expired', expiredAt: new Date() } }
      );
      return res.json({ status: 'expired' });
    }

    if (session.status === 'completed') {
      return res.json({ status: 'completed' });
    }

    if (session.status === 'cancelled' || session.status === 'expired') {
      return res.json({ status: session.status });
    }

    const currentBalance = await paymentService.fetchBalance();

    if (session.initialBalance === null) {
      await db.collection('payment_sessions').updateOne(
        { orderId },
        { $set: { initialBalance: currentBalance } }
      );
      return res.json({ status: 'pending' });
    }

    const { isValid, diff, expected } = paymentService.validatePayment(
      session.initialBalance,
      currentBalance,
      session.totalAmount
    );

    await db.collection('logs').insertOne({
      action: 'payment-status-check',
      orderId,
      initialBalance: session.initialBalance,
      currentBalance,
      expected,
      diff,
      timestamp: new Date(),
    });

    if (isValid) {
      await db.collection('payment_sessions').updateOne(
        { orderId },
        {
          $set: {
            status: 'completed',
            finalBalance: currentBalance,
            completedAt: new Date(),
          },
        }
      );

      await db.collection('orders').insertOne({
        orderId: session.orderId,
        productDetails: session.productDetails,
        deliveryDetails: session.deliveryDetails,
        email: session.email,
        totalAmount: session.totalAmount,
        basePrice: session.basePrice,
        taxValue: session.taxValue,
        paymentMethod: 'UPI',
        status: 'confirmed',
        createdAt: new Date(),
        ip: session.ip,
        userAgent: session.userAgent,
        coupon: session.coupon,
      });

      logger.info(`Payment completed: ${orderId}`);
      return res.json({ status: 'completed' });
    }

    res.json({ status: 'pending' });
  } catch (error) {
    logger.error('Payment status check error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

router.post('/payment-done', orderIdValidation, validate, async (req, res) => {
  try {
    const db = databaseService.getDb();
    const { orderId } = req.body;

    const session = await db.collection('payment_sessions').findOne({ orderId });

    if (!session) {
      return res.status(404).json({ error: 'Payment session not found' });
    }

    if (session.status === 'completed') {
      return res.json({ status: 'already-completed' });
    }

    const finalBalance = await paymentService.fetchBalance();
    const { isValid, diff, expected } = paymentService.validatePayment(
      session.initialBalance,
      finalBalance,
      session.totalAmount
    );

    await db.collection('logs').insertOne({
      action: 'payment-done-check',
      orderId,
      initialBalance: session.initialBalance,
      finalBalance,
      expected,
      diff,
      timestamp: new Date(),
    });

    if (isValid) {
      await db.collection('payment_sessions').updateOne(
        { orderId },
        {
          $set: {
            status: 'completed',
            finalBalance,
            completedAt: new Date(),
          },
        }
      );

      await db.collection('orders').insertOne({
        orderId: session.orderId,
        productDetails: session.productDetails,
        deliveryDetails: session.deliveryDetails,
        email: session.email,
        totalAmount: session.totalAmount,
        basePrice: session.basePrice,
        taxValue: session.taxValue,
        paymentMethod: 'UPI',
        status: 'confirmed',
        createdAt: new Date(),
        ip: session.ip,
        userAgent: session.userAgent,
        coupon: session.coupon,
      });

      logger.info(`Payment confirmed via done: ${orderId}`);
      return res.json({ status: 'completed' });
    } else {
      return res.json({ status: 'not-matched', diff, expected });
    }
  } catch (error) {
    logger.error('Payment done error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

router.post('/payment-cancel', orderIdValidation, validate, async (req, res) => {
  try {
    const db = databaseService.getDb();
    const { orderId } = req.body;

    await db.collection('payment_sessions').updateOne(
      { orderId },
      { $set: { status: 'cancelled', cancelledAt: new Date() } }
    );

    await db.collection('logs').insertOne({
      action: 'payment-cancel',
      orderId,
      timestamp: new Date(),
    });

    logger.info(`Payment cancelled: ${orderId}`);
    res.json({ status: 'cancelled' });
  } catch (error) {
    logger.error('Payment cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel payment' });
  }
});

router.get('/order/:orderId', orderIdParamValidation, validate, async (req, res) => {
  try {
    const db = databaseService.getDb();
    const { orderId } = req.params;

    const order = await db.collection('orders').findOne({ orderId });

    if (order) {
      res.json({ success: true, order });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    logger.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.get('/upi-qr', async (req, res) => {
  try {
    const { amount, note } = req.query;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const paymentQR = await qrService.generatePaymentQR(
      parseFloat(amount),
      note || 'Payment'
    );

    res.json(paymentQR);
  } catch (error) {
    logger.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const balance = await paymentService.fetchBalance();
    res.json({ balance });
  } catch (error) {
    logger.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
