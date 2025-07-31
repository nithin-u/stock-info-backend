const express = require('express');
const {
  getWatchlists,
  getWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  addStockToWatchlist,
  removeStockFromWatchlist
} = require('../controllers/watchlistController');
const { protect } = require('../middleware/auth');
const { validateWatchlist, validateTicker } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for watchlist routes
const watchlistLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All watchlist routes require authentication
router.use(protect);
router.use(watchlistLimiter);

// @route   GET /api/watchlists
// @desc    Get all user's watchlists
// @access  Private
router.get('/', getWatchlists);

// @route   POST /api/watchlists
// @desc    Create new watchlist
// @access  Private
router.post('/', validateWatchlist, createWatchlist);

// @route   GET /api/watchlists/:id
// @desc    Get single watchlist with populated data
// @access  Private
router.get('/:id', getWatchlist);

// @route   PUT /api/watchlists/:id
// @desc    Update watchlist details
// @access  Private
router.put('/:id', validateWatchlist, updateWatchlist);

// @route   DELETE /api/watchlists/:id
// @desc    Delete watchlist
// @access  Private
router.delete('/:id', deleteWatchlist);

// @route   POST /api/watchlists/:id/stocks
// @desc    Add stock to watchlist
// @access  Private
router.post('/:id/stocks', validateTicker, addStockToWatchlist);

// @route   DELETE /api/watchlists/:id/stocks/:ticker
// @desc    Remove stock from watchlist
// @access  Private
router.delete('/:id/stocks/:ticker', removeStockFromWatchlist);

module.exports = router;
