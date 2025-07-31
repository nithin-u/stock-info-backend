const MutualFund = require('../models/MutualFund');
const logger = require('../utils/logger');

// @desc    Get all mutual funds
// @route   GET /api/mutual-funds
// @access  Public
exports.getMutualFunds = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const category = req.query.category;
    const fundHouse = req.query.fundHouse;
    const sortBy = req.query.sortBy || 'aum';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    let query = { isActive: true };
    if (category && category !== 'All Types') {
      query.category = category;
    }
    if (fundHouse && fundHouse !== 'All Fund Houses') {
      query.fundHouse = fundHouse;
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const funds = await MutualFund.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip(startIndex)
      .exec();

    // Get total count
    const total = await MutualFund.countDocuments(query);

    // Pagination result
    const pagination = {};

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
      count: funds.length,
      total,
      pagination,
      data: funds
    });
  } catch (error) {
    logger.error('Get mutual funds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single mutual fund details
// @route   GET /api/mutual-funds/:schemeCode
// @access  Public
exports.getMutualFund = async (req, res) => {
  try {
    const fund = await MutualFund.findOne({ 
      schemeCode: req.params.schemeCode,
      isActive: true 
    });

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Mutual fund not found'
      });
    }

    res.status(200).json({
      success: true,
      data: fund
    });
  } catch (error) {
    logger.error('Get mutual fund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Search mutual funds
// @route   GET /api/mutual-funds/search/:query
// @access  Public
exports.searchMutualFunds = async (req, res) => {
  try {
    const query = req.params.query;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const funds = await MutualFund.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { schemeName: { $regex: query, $options: 'i' } },
            { fundHouse: { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .limit(limit)
    .select('schemeCode schemeName nav navChangePercent category fundHouse')
    .sort({ aum: -1 });

    res.status(200).json({
      success: true,
      count: funds.length,
      data: funds
    });
  } catch (error) {
    logger.error('Search mutual funds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get fund categories
// @route   GET /api/mutual-funds/categories
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await MutualFund.distinct('category', { isActive: true });
    
    res.status(200).json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get fund houses
// @route   GET /api/mutual-funds/fund-houses
// @access  Public
exports.getFundHouses = async (req, res) => {
  try {
    const fundHouses = await MutualFund.distinct('fundHouse', { isActive: true });
    
    res.status(200).json({
      success: true,
      data: fundHouses.sort()
    });
  } catch (error) {
    logger.error('Get fund houses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get top performing funds
// @route   GET /api/mutual-funds/top-performers
// @access  Public
exports.getTopPerformers = async (req, res) => {
  try {
    const period = req.query.period || '1Year';
    const limit = parseInt(req.query.limit, 10) || 10;

    let sortField = 'performance.returns1Year';
    switch (period) {
      case '1Month':
        sortField = 'performance.returns1Month';
        break;
      case '3Month':
        sortField = 'performance.returns3Month';
        break;
      case '6Month':
        sortField = 'performance.returns6Month';
        break;
      case '3Year':
        sortField = 'performance.returns3Year';
        break;
      case '5Year':
        sortField = 'performance.returns5Year';
        break;
    }

    const performers = await MutualFund.find({
      isActive: true,
      [sortField]: { $exists: true, $ne: null }
    })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select(`schemeCode schemeName nav fundHouse category ${sortField}`);

    res.status(200).json({
      success: true,
      period,
      count: performers.length,
      data: performers
    });
  } catch (error) {
    logger.error('Get top performers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
