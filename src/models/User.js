const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'premium', 'admin'],
    default: 'user'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    currency: {
      type: String,
      enum: ['INR', 'USD'],
      default: 'INR'
    },
    language: {
      type: String,
      enum: ['en', 'hi'],
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      priceAlerts: { type: Boolean, default: true }
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  lastLogin: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it has been modified or is new
  if (!this.isModified('password')) return next();
  
  try {
    console.log('🔐 Hashing password for user:', this.email);
    
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    console.log('✅ Password hashed successfully');
    next();
  } catch (error) {
    console.error('❌ Password hashing error:', error);
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('🔍 Comparing password for user:', this.email);
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    
    console.log('🔐 Password comparison result:', isMatch ? '✅ Match' : '❌ No match');
    
    return isMatch;
  } catch (error) {
    console.error('❌ Password comparison error:', error);
    throw error;
  }
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function() {
  try {
    console.log('🔑 Generating JWT token for user:', this._id);
    
    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    
    const payload = {
      id: this._id,
      email: this.email,
      role: this.role
    };
    
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
    
    console.log('✅ JWT token generated successfully');
    return token;
    
  } catch (error) {
    console.error('❌ JWT token generation error:', error);
    throw error;
  }
};

// Virtual for user's watchlists
userSchema.virtual('watchlists', {
  ref: 'Watchlist',
  localField: '_id',
  foreignField: 'user'
});

// Add error handling for duplicate key errors
userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    next(new Error(`User with this ${field} already exists`));
  } else {
    next(error);
  }
});

// Add validation for password strength (optional)
userSchema.pre('validate', function(next) {
  if (this.isModified('password') && this.password) {
    // Check password strength
    if (this.password.length < 6) {
      this.invalidate('password', 'Password must be at least 6 characters long');
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
