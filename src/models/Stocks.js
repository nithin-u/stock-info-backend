const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  exchange: {
    type: String,
    enum: ['NSE', 'BSE'],
    required: true
  },
  sector: {
    type: String,
    required: true,
    trim: true
  },
  industry: {
    type: String,
    required: true,
    trim: true
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  previousClose: {
    type: Number,
    required: true,
    min: 0
  },
  dayChange: {
    type: Number,
    required: true
  },
  dayChangePercent: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    default: 0,
    min: 0
  },
  avgVolume: {
    type: Number,
    default: 0,
    min: 0
  },
  marketCap: {
    type: Number,
    min: 0
  },
  peRatio: {
    type: Number,
    min: 0
  },
  pbRatio: {
    type: Number,
    min: 0
  },
  eps: {
    type: Number
  },
  dividend: {
    type: Number,
    default: 0,
    min: 0
  },
  dividendYield: {
    type: Number,
    default: 0,
    min: 0
  },
  high52Week: {
    type: Number,
    min: 0
  },
  low52Week: {
    type: Number,
    min: 0
  },
  beta: {
    type: Number,
    default: 1
  },
  priceHistory: [{
    date: {
      type: Date,
      required: true
    },
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
  }],
  fundamentals: {
    revenue: Number,
    netIncome: Number,
    totalAssets: Number,
    totalLiabilities: Number,
    shareholderEquity: Number,
    operatingCashFlow: Number,
    freeCashFlow: Number
  },
  companyInfo: {
    description: String,
    website: String,
    employees: Number,
    founded: Number,
    headquarters: String,
    ceo: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPennyStock: {
    type: Boolean,
    default: function() {
      return this.currentPrice <= 50; // Stocks under ₹50
    }
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

// Virtual for current change
stockSchema.virtual('change').get(function() {
  return this.currentPrice - this.previousClose;
});

// Virtual for change percentage
stockSchema.virtual('changePercent').get(function() {
  return ((this.currentPrice - this.previousClose) / this.previousClose) * 100;
});

// Index for efficient queries
stockSchema.index({ ticker: 1, exchange: 1 });
stockSchema.index({ sector: 1 });
stockSchema.index({ isPennyStock: 1 });
stockSchema.index({ marketCap: 1 });
stockSchema.index({ lastUpdated: 1 });

// Update isPennyStock when price changes
stockSchema.pre('save', function(next) {
  this.isPennyStock = this.currentPrice <= 50;
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
