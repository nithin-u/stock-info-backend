const mongoose = require('mongoose');

const mutualFundSchema = new mongoose.Schema({
  schemeCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  schemeName: {
    type: String,
    required: true,
    trim: true
  },
  fundHouse: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Equity', 'Debt', 'Hybrid', 'Index', 'Other']
  },
  subCategory: {
    type: String,
    required: true,
    trim: true
  },
  nav: {
    type: Number,
    required: true,
    min: 0
  },
  previousNav: {
    type: Number,
    required: true,
    min: 0
  },
  navChange: {
    type: Number,
    default: 0
  },
  navChangePercent: {
    type: Number,
    default: 0
  },
  navDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: 'NAV date must be a valid date'
    }
  },
  // Fixed: NAV history with proper date validation
  navHistory: [{
    date: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          return v instanceof Date && !isNaN(v.getTime());
        },
        message: 'Date must be a valid date'
      }
    },
    nav: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function(v) {
          return !isNaN(v) && v >= 0;
        },
        message: 'NAV must be a valid positive number'
      }
    }
  }],
  minInvestment: {
    type: Number,
    default: 500,
    min: 0
  },
  sipMinInvestment: {
    type: Number,
    default: 500,
    min: 0
  },
  expenseRatio: {
    type: Number,
    min: 0,
    max: 5
  },
  exitLoad: {
    type: String,
    default: 'Nil'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for NAV change
mutualFundSchema.virtual('navChangeVirtual').get(function() {
  return this.nav - this.previousNav;
});

// Virtual for NAV change percentage
mutualFundSchema.virtual('navChangePercentVirtual').get(function() {
  return ((this.nav - this.previousNav) / this.previousNav) * 100;
});

// Indexes for efficient queries
mutualFundSchema.index({ schemeCode: 1 });
mutualFundSchema.index({ fundHouse: 1 });
mutualFundSchema.index({ category: 1, subCategory: 1 });
mutualFundSchema.index({ navDate: -1 });
mutualFundSchema.index({ lastUpdated: 1 });

// Update lastUpdated when NAV changes
mutualFundSchema.pre('save', function(next) {
  if (this.isModified('nav')) {
    this.lastUpdated = new Date();
    this.navChange = this.nav - this.previousNav;
    this.navChangePercent = ((this.navChange / this.previousNav) * 100);
  }
  next();
});

module.exports = mongoose.model('MutualFund', mutualFundSchema);
