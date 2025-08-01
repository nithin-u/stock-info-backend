const User = require('../models/User');
const Watchlist = require('../models/Watchlist');
const logger = require('../utils/logger');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Enhanced logging for debugging
    logger.info('📝 Registration attempt:', { name, email, hasPassword: !!password });

    // Validate required fields
    if (!name || !email || !password) {
      logger.warn('❌ Missing required fields in registration');
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Validate email format (additional check)
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      logger.warn('❌ Invalid email format:', email);
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password length
    if (password.length < 6) {
      logger.warn('❌ Password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    logger.info('🔍 Checking if user exists:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('❌ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    logger.info('👤 Creating new user:', email);
    const user = await User.create({
      name,
      email,
      password
    });

    logger.info('✅ User created successfully:', { id: user._id, email: user.email });

    // Create default watchlist
    logger.info('📋 Creating default watchlist for user:', user._id);
    await Watchlist.create({
      user: user._id,
      name: 'My Favorites',
      description: 'Your default watchlist',
      isDefault: true
    });

    logger.info('✅ Default watchlist created successfully');

    // Send token response
    logger.info('🔑 Generating JWT token for user:', user._id);
    sendTokenResponse(user, 201, res);
    
  } catch (error) {
    logger.error('❌ Registration error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Enhanced logging for debugging
    logger.info('🔐 Login attempt for email:', email);

    // Validate required fields
    if (!email || !password) {
      logger.warn('❌ Missing email or password in login');
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    logger.info('🔍 Finding user in database:', email);
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      logger.warn('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    logger.info('👤 User found, checking password...');

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logger.warn('❌ Password mismatch for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    logger.info('✅ Password verified, updating last login...');

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    logger.info('✅ Login successful for user:', user._id);

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error('❌ Login error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    res.status(500).json({
      success: false,
      message: 'Server Error during login'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    logger.info('👤 Getting user profile for ID:', req.user.id);

    const user = await User.findById(req.user.id).populate({
      path: 'watchlists',
      select: 'name color totalItems'
    });

    if (!user) {
      logger.warn('❌ User not found for ID:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('✅ User profile retrieved successfully');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('❌ Get user error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res) => {
  try {
    logger.info('📝 Updating user details for ID:', req.user.id);

    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      preferences: req.body.preferences
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => {
      if (fieldsToUpdate[key] === undefined) {
        delete fieldsToUpdate[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    if (!user) {
      logger.warn('❌ User not found for update:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('✅ User details updated successfully');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('❌ Update details error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res) => {
  try {
    logger.info('🔒 Password update attempt for user:', req.user.id);

    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      logger.warn('❌ Missing passwords in update request');
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      logger.warn('❌ User not found for password update:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      logger.warn('❌ Current password incorrect for user:', req.user.id);
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    logger.info('✅ Current password verified, updating...');

    user.password = newPassword;
    await user.save();

    logger.info('✅ Password updated successfully');

    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error('❌ Update password error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    logger.info('🚪 User logout:', req.user?.id);

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    logger.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  try {
    logger.info('🔑 Generating token response for user:', user._id);

    // Create token
    const token = user.getSignedJwtToken();

    const options = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true
    };

    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
    }

    logger.info('✅ Token generated successfully, sending response');

    res
      .status(statusCode)
      .cookie('token', token, options)
      .json({
        success: true,
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountType: user.role === 'user' ? 'registered' : user.role,
          joinDate: user.createdAt
        }
      });
  } catch (error) {
    logger.error('❌ Token response error:', {
      message: error.message,
      stack: error.stack,
      userId: user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error generating authentication token'
    });
  }
};
