const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for market routes
const marketLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per minute
  message: {
    success: false,
    message: 'Too many requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(marketLimiter);

// @route   GET /api/market/indices
// @desc    Get major Indian market indices (NIFTY, SENSEX, etc.)
// @access  Public
router.get('/indices', optionalAuth, async (req, res) => {
  try {
    // Mock data for now - will be replaced with real API calls
    const indices = [
      {
        name: 'NIFTY 50',
        value: 24010.90,
        change: 285.75,
        changePercent: 1.20,
        lastUpdated: new Date()
      },
      {
        name: 'SENSEX',
        value: 78765.86,
        change: 628.50,
        changePercent: 0.81,
        lastUpdated: new Date()
      },
      {
        name: 'BANK NIFTY',
        value: 51247.35,
        change: -156.25,
        changePercent: -0.30,
        lastUpdated: new Date()
      },
      {
        name: 'NIFTY IT',
        value: 40156.45,
        change: 845.30,
        changePercent: 2.15,
        lastUpdated: new Date()
      }
    ];

    res.status(200).json({
      success: true,
      count: indices.length,
      data: indices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

// @route   GET /api/market/status
// @desc    Get market status (open/closed)
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    // Indian market hours: 9:15 AM to 3:30 PM IST
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    const isOpen = currentTime >= marketOpen && currentTime <= marketClose;
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    res.status(200).json({
      success: true,
      data: {
        isOpen: isOpen && !isWeekend,
        currentTime: now.toISOString(),
        marketOpenTime: '09:15',
        marketCloseTime: '15:30',
        timezone: 'IST'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
});

module.exports = router;
