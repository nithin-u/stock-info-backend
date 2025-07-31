const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
exports.validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  exports.handleValidationErrors
];

// User login validation
exports.validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  exports.handleValidationErrors
];

// Watchlist validation
exports.validateWatchlist = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Watchlist name must be between 1 and 50 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  
  body('color')
    .optional()
    .isIn(['blue', 'green', 'red', 'purple', 'orange', 'pink'])
    .withMessage('Invalid color selection'),
  
  exports.handleValidationErrors
];

// Stock ticker validation
exports.validateTicker = [
  body('ticker')
    .trim()
    .toUpperCase()
    .isLength({ min: 1, max: 20 })
    .withMessage('Ticker must be between 1 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Ticker can only contain letters and numbers'),
  
  exports.handleValidationErrors
];
