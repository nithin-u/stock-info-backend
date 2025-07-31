const Stock = require('../models/Stocks');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

// @desc    Get all penny stocks
// @route   GET /api/stocks/penny
// @access  Public
exports.getPennyStocks = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;  // Fix: default to 1, not 20
    const limit = parseInt(req.query.limit, 10) || 20;
    const sector = req.query.sector;
    const search = req.query.search; // Add search support
    const sortBy = req.query.sortBy || 'marketCap';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    let query = { isPennyStock: true, isActive: true };
    
    if (sector && sector !== 'All Sectors') {
      query.sector = sector;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { ticker: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { sector: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const stocks = await Stock.find(query)
      .sort(sort)
      .limit(limit)  // Remove the "* 1" part
      .skip(startIndex)
      .exec();

    // Get total count for pagination
    const total = await Stock.countDocuments(query);
    const totalPages = Math.ceil(total / limit); // Add totalPages

    // Pagination result - Enhanced
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalItems: total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: stocks.length,
      total,
      pagination,
      data: stocks
    });
  } catch (error) {
    logger.error('Get penny stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};


// @desc    Get single stock details
// @route   GET /api/stocks/:ticker
// @access  Public
exports.getStock = async (req, res) => {
  try {
    const stock = await Stock.findOne({ 
      ticker: req.params.ticker.toUpperCase(),
      isActive: true 
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    res.status(200).json({
      success: true,
      data: stock
    });
  } catch (error) {
    logger.error('Get stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Search stocks
// @route   GET /api/stocks/search/:query
// @access  Public
exports.searchStocks = async (req, res) => {
  try {
    const query = req.params.query;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const stocks = await Stock.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { ticker: { $regex: query, $options: 'i' } },
            { name: { $regex: query, $options: 'i' } },
            { sector: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .limit(limit)
    .select('ticker name currentPrice dayChangePercent sector exchange')
    .sort({ marketCap: -1 });

    res.status(200).json({
      success: true,
      count: stocks.length,
      data: stocks
    });
  } catch (error) {
    logger.error('Search stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get stock sectors
// @route   GET /api/stocks/sectors
// @access  Public
exports.getSectors = async (req, res) => {
  try {
    const sectors = await Stock.distinct('sector', { isActive: true });
    
    res.status(200).json({
      success: true,
      data: sectors.sort()
    });
  } catch (error) {
    logger.error('Get sectors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get stock price history
// @route   GET /api/stocks/:ticker/history
// @access  Public
exports.getStockHistory = async (req, res) => {
  try {
    const { ticker } = req.params;
    const { period = '1M' } = req.query;

    const stock = await Stock.findOne({ 
      ticker: ticker.toUpperCase(),
      isActive: true 
    }).select('priceHistory ticker name');

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    // Filter history based on period
    let filteredHistory = stock.priceHistory;
    const now = new Date();
    let cutoffDate;

    switch (period) {
      case '1W':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    filteredHistory = stock.priceHistory.filter(item => 
      item.date >= cutoffDate
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      success: true,
      data: {
        ticker: stock.ticker,
        name: stock.name,
        period,
        history: filteredHistory
      }
    });
  } catch (error) {
    logger.error('Get stock history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get top gainers
// @route   GET /api/stocks/gainers
// @access  Public
exports.getTopGainers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    const gainers = await Stock.find({
      isActive: true,
      dayChangePercent: { $gt: 0 }
    })
    .sort({ dayChangePercent: -1 })
    .limit(limit)
    .select('ticker name currentPrice dayChange dayChangePercent sector exchange');

    res.status(200).json({
      success: true,
      count: gainers.length,
      data: gainers
    });
  } catch (error) {
    logger.error('Get top gainers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get top losers
// @route   GET /api/stocks/losers
// @access  Public
exports.getTopLosers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;

    const losers = await Stock.find({
      isActive: true,
      dayChangePercent: { $lt: 0 }
    })
    .sort({ dayChangePercent: 1 })
    .limit(limit)
    .select('ticker name currentPrice dayChange dayChangePercent sector exchange');

    res.status(200).json({
      success: true,
      count: losers.length,
      data: losers
    });
  } catch (error) {
    logger.error('Get top losers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
