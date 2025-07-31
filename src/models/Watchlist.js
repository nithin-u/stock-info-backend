const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Watchlist name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  color: {
    type: String,
    enum: ['blue', 'green', 'red', 'purple', 'orange', 'pink'],
    default: 'blue'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  stocks: [{
    ticker: {
      type: String,
      required: true,
      uppercase: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    alertPrice: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      maxlength: 500
    }
  }],
  mutualFunds: [{
    schemeCode: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    targetNav: {
      type: Number,
      min: 0
    },
    notes: {
      type: String,
      maxlength: 500
    }
  }],
  totalValue: {
    type: Number,
    default: 0
  },
  totalChange: {
    type: Number,
    default: 0
  },
  totalChangePercent: {
    type: Number,
    default: 0
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total items
watchlistSchema.virtual('totalItems').get(function() {
  return this.stocks.length + this.mutualFunds.length;
});

// Compound index for user watchlists
watchlistSchema.index({ user: 1, name: 1 }, { unique: true });
watchlistSchema.index({ user: 1, isDefault: 1 });

// Ensure only one default watchlist per user
watchlistSchema.pre('save', async function(next) {
  if (this.isDefault) {
    // Remove default flag from other watchlists of the same user
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Watchlist', watchlistSchema);
