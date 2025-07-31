const stockController = require('../controllers/stockController');
const express = require('express');
const {
  getPennyStocks,
  getStock,
  searchStocks,
  getSectors,
  getStockHistory,
  getTopGainers,
  getTopLosers
} = require('../controllers/stockController');
const { optionalAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for stock routes
const stockLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all stock routes
router.use(stockLimiter);

// @route   GET /api/stocks/penny
// @desc    Get all penny stocks with pagination and filters
// @access  Public
// @query   ?page=1&limit=20&sector=Banking&sortBy=marketCap&sortOrder=desc
router.get('/penny', optionalAuth, getPennyStocks);

// @route   GET /api/stocks/sectors
// @desc    Get all available sectors
// @access  Public
router.get('/sectors', getSectors);

// @route   GET /api/stocks/gainers
// @desc    Get top gaining stocks
// @access  Public
// @query   ?limit=10
router.get('/gainers', getTopGainers);

// @route   GET /api/stocks/losers
// @desc    Get top losing stocks
// @access  Public
// @query   ?limit=10
router.get('/losers', getTopLosers);

// @route   GET /api/stocks/search/:query
// @desc    Search stocks by ticker, name, or sector
// @access  Public
// @query   ?limit=10
router.get('/search/:query', searchStocks);

// @route   GET /api/stocks/:ticker/history
// @desc    Get stock price history
// @access  Public
// @query   ?period=1M (1W, 1M, 3M, 6M, 1Y)
router.get('/:ticker/history', getStockHistory);

// @route   GET /api/stocks/:ticker
// @desc    Get single stock details
// @access  Public
router.get('/:ticker', optionalAuth, getStock);
router.get('/penny', stockController.getPennyStocks);
module.exports = router;
