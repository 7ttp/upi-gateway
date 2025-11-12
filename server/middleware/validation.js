import { body, param, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

export const createSessionValidation = [
  body('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
  body('productDetails').isObject().withMessage('Product details must be an object'),
  body('deliveryDetails').isObject().withMessage('Delivery details must be an object'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('nonce').isString().trim().notEmpty().withMessage('Nonce is required'),
  body('tax').isFloat({ min: 0 }).withMessage('Tax must be a positive number'),
  body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  body('couponCode').optional().isString(),
];

export const orderIdValidation = [
  body('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
];

export const orderIdParamValidation = [
  param('orderId').isString().trim().notEmpty().withMessage('Order ID is required'),
];
