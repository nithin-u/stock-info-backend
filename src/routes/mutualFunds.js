const express = require('express');
const {
  getMutualFunds,
  getMutualFund,
  searchMutualFunds,
  getCategories,
  getFundHouses,
  getTopPerformers
} = require('../controllers/mutualFundController');
const { optionalAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for mutual fund routes
const fundLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all fund routes
router.use(fundLimiter);

// @route   GET /api/mutual-funds
// @desc    Get all mutual funds with pagination and filters
// @access  Public
// @query   ?page=1&limit=20&category=Equity&fundHouse=SBI&sortBy=aum&sortOrder=desc
router.get('/', optionalAuth, getMutualFunds);

// @route   GET /api/mutual-funds/categories
// @desc    Get all fund categories
// @access  Public
router.get('/categories', getCategories);

// @route   GET /api/mutual-funds/fund-houses
// @desc    Get all fund houses
// @access  Public
router.get('/fund-houses', getFundHouses);

// @route   GET /api/mutual-funds/top-performers
// @desc    Get top performing funds
// @access  Public
// @query   ?period=1Year&limit=10
router.get('/top-performers', getTopPerformers);

// @route   GET /api/mutual-funds/search/:query
// @desc    Search mutual funds
// @access  Public
// @query   ?limit=10
router.get('/search/:query', searchMutualFunds);

// @route   GET /api/mutual-funds/:schemeCode
// @desc    Get single mutual fund details
// @access  Public
router.get('/:schemeCode', optionalAuth, getMutualFund);

module.exports = router;
