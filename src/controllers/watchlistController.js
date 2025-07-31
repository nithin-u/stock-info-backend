const Watchlist = require('../models/Watchlist');
const Stock = require('../models/Stocks');
const MutualFund = require('../models/MutualFund');
const logger = require('../utils/logger');

// @desc    Get user's watchlists
// @route   GET /api/watchlists
// @access  Private
exports.getWatchlists = async (req, res) => {
  try {
    const watchlists = await Watchlist.find({ user: req.user.id })
      .sort({ isDefault: -1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: watchlists.length,
      data: watchlists
    });
  } catch (error) {
    logger.error('Get watchlists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single watchlist with populated data
// @route   GET /api/watchlists/:id
// @access  Private
exports.getWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    // Get stock data for all stocks in watchlist
    const stockTickers = watchlist.stocks.map(stock => stock.ticker);
    const stocksData = await Stock.find({
      ticker: { $in: stockTickers },
      isActive: true
    }).select('ticker name currentPrice dayChange dayChangePercent sector exchange');

    // Get mutual fund data for all funds in watchlist
    const fundCodes = watchlist.mutualFunds.map(fund => fund.schemeCode);
    const fundsData = await MutualFund.find({
      schemeCode: { $in: fundCodes },
      isActive: true
    }).select('schemeCode schemeName nav navChange navChangePercent fundHouse category');

    // Combine watchlist items with current market data
    const enrichedStocks = watchlist.stocks.map(watchlistStock => {
      const stockData = stocksData.find(stock => stock.ticker === watchlistStock.ticker);
      return {
        ...watchlistStock.toObject(),
        marketData: stockData || null
      };
    });

    const enrichedFunds = watchlist.mutualFunds.map(watchlistFund => {
      const fundData = fundsData.find(fund => fund.schemeCode === watchlistFund.schemeCode);
      return {
        ...watchlistFund.toObject(),
        marketData: fundData || null
      };
    });

    const enrichedWatchlist = {
      ...watchlist.toObject(),
      stocks: enrichedStocks,
      mutualFunds: enrichedFunds
    };

    res.status(200).json({
      success: true,
      data: enrichedWatchlist
    });
  } catch (error) {
    logger.error('Get watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create new watchlist
// @route   POST /api/watchlists
// @access  Private
exports.createWatchlist = async (req, res) => {
  try {
    const { name, description, color } = req.body;

    // Check if watchlist name already exists for user
    const existingWatchlist = await Watchlist.findOne({
      user: req.user.id,
      name: name.trim()
    });

    if (existingWatchlist) {
      return res.status(400).json({
        success: false,
        message: 'Watchlist with this name already exists'
      });
    }

    const watchlist = await Watchlist.create({
      user: req.user.id,
      name: name.trim(),
      description: description?.trim(),
      color: color || 'blue'
    });

    res.status(201).json({
      success: true,
      data: watchlist
    });
  } catch (error) {
    logger.error('Create watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update watchlist
// @route   PUT /api/watchlists/:id
// @access  Private
exports.updateWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    const { name, description, color } = req.body;

    // Check if new name conflicts with existing watchlist
    if (name && name.trim() !== watchlist.name) {
      const existingWatchlist = await Watchlist.findOne({
        user: req.user.id,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingWatchlist) {
        return res.status(400).json({
          success: false,
          message: 'Watchlist with this name already exists'
        });
      }
    }

    const updatedWatchlist = await Watchlist.findByIdAndUpdate(
      req.params.id,
      {
        name: name?.trim() || watchlist.name,
        description: description?.trim() || watchlist.description,
        color: color || watchlist.color
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedWatchlist
    });
  } catch (error) {
    logger.error('Update watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete watchlist
// @route   DELETE /api/watchlists/:id
// @access  Private
exports.deleteWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    // Prevent deletion of default watchlist
    if (watchlist.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default watchlist'
      });
    }

    await Watchlist.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Watchlist deleted successfully'
    });
  } catch (error) {
    logger.error('Delete watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Add stock to watchlist
// @route   POST /api/watchlists/:id/stocks
// @access  Private
exports.addStockToWatchlist = async (req, res) => {
  try {
    const { ticker, alertPrice, notes } = req.body;

    // Verify stock exists
    const stock = await Stock.findOne({ 
      ticker: ticker.toUpperCase(),
      isActive: true 
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    // Check if stock is already in watchlist
    const existingStock = watchlist.stocks.find(s => s.ticker === ticker.toUpperCase());
    if (existingStock) {
      return res.status(400).json({
        success: false,
        message: 'Stock already in watchlist'
      });
    }

    // Add stock to watchlist
    watchlist.stocks.push({
      ticker: ticker.toUpperCase(),
      alertPrice,
      notes
    });

    await watchlist.save();

    res.status(200).json({
      success: true,
      message: 'Stock added to watchlist',
      data: watchlist
    });
  } catch (error) {
    logger.error('Add stock to watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Remove stock from watchlist
// @route   DELETE /api/watchlists/:id/stocks/:ticker
// @access  Private
exports.removeStockFromWatchlist = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    const ticker = req.params.ticker.toUpperCase();
    const stockIndex = watchlist.stocks.findIndex(s => s.ticker === ticker);

    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found in watchlist'
      });
    }

    watchlist.stocks.splice(stockIndex, 1);
    await watchlist.save();

    res.status(200).json({
      success: true,
      message: 'Stock removed from watchlist',
      data: watchlist
    });
  } catch (error) {
    logger.error('Remove stock from watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
