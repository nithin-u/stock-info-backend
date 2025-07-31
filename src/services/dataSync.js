const cron = require('node-cron');
const Stock = require('../models/Stocks');
const MutualFund = require('../models/MutualFund');
const nseService = require('./nseService');
const amfiService = require('./amfiService');
const logger = require('../utils/logger');

class DataSyncService {
  constructor() {
    this.isRunning = false;
    this.lastStockSync = null;
    this.lastMutualFundSync = null;
  }

  // Initialize cron jobs
  initCronJobs() {
    // Sync stocks every 5 minutes during market hours (9:15 AM - 3:30 PM IST)
    cron.schedule('*/5 9-15 * * 1-5', async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;
      
      // Market hours: 9:15 AM to 3:30 PM
      const marketOpen = 9 * 60 + 15;
      const marketClose = 15 * 60 + 30;
      
      if (currentTime >= marketOpen && currentTime <= marketClose) {
        logger.info('Market is open - starting stock data sync');
        await this.syncStockData();
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Sync mutual funds daily at 6 PM IST (after market closes)
    cron.schedule('0 18 * * 1-5', async () => {
      logger.info('Starting daily mutual fund sync');
      await this.syncMutualFundData();
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Sync penny stocks list weekly on Sunday at 2 AM
    cron.schedule('0 2 * * 0', async () => {
      logger.info('Starting weekly penny stocks discovery');
      await this.discoverPennyStocks();
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Data sync cron jobs initialized');
  }

  // Sync stock data
  async syncStockData() {
    if (this.isRunning) {
      logger.warn('Data sync already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting stock data synchronization');

      // Get all active stocks from database
      const stocks = await Stock.find({ isActive: true }).select('ticker');
      const tickers = stocks.map(stock => stock.ticker);

      if (tickers.length === 0) {
        logger.info('No stocks found in database for sync');
        return;
      }

      logger.info(`Syncing ${tickers.length} stocks`);

      // Process stocks in batches of 10 to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tickers.length/batchSize)}`);

        try {
          const stocksData = await nseService.getMultipleStocks(batch);
          
          // Update database with new data
          for (const stockData of stocksData) {
            await this.updateStockInDatabase(stockData);
          }
          
          // Wait 2 seconds between batches to respect rate limits
          await this.sleep(2000);
        } catch (error) {
          logger.error(`Error processing batch: ${error.message}`);
        }
      }

      this.lastStockSync = new Date();
      logger.info('Stock data synchronization completed');
    } catch (error) {
      logger.error('Error in stock data sync:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  // Update stock data in database
  async updateStockInDatabase(stockData) {
    try {
      const existingStock = await Stock.findOne({ ticker: stockData.ticker });
      
      if (existingStock) {
        // Update existing stock
        await Stock.findByIdAndUpdate(existingStock._id, {
          currentPrice: stockData.currentPrice,
          previousClose: stockData.previousClose,
          dayChange: stockData.dayChange,
          dayChangePercent: stockData.dayChangePercent,
          volume: stockData.volume,
          high52Week: stockData.high52Week,
          low52Week: stockData.low52Week,
          marketCap: stockData.marketCap,
          // Add new price data to history (keep last 90 days)
          $push: {
            priceHistory: {
              $each: stockData.priceHistory,
              $slice: -90
            }
          },
          lastUpdated: new Date()
        });
        
        logger.debug(`Updated stock data for ${stockData.ticker}`);
      } else {
        logger.warn(`Stock ${stockData.ticker} not found in database`);
      }
    } catch (error) {
      logger.error(`Error updating stock ${stockData.ticker}:`, error.message);
    }
  }

  // Sync mutual fund data
  async syncMutualFundData() {
    try {
      logger.info('Starting mutual fund data synchronization');

      // Get all active mutual funds from database
      const funds = await MutualFund.find({ isActive: true }).select('schemeCode');
      const schemeCodes = funds.map(fund => fund.schemeCode);

      if (schemeCodes.length === 0) {
        logger.info('No mutual funds found in database for sync');
        return;
      }

      logger.info(`Syncing ${schemeCodes.length} mutual funds`);

      // Process funds in batches of 5 to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < schemeCodes.length; i += batchSize) {
        const batch = schemeCodes.slice(i, i + batchSize);
        logger.info(`Processing MF batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(schemeCodes.length/batchSize)}`);

        try {
          const fundsData = await amfiService.getMultipleMutualFunds(batch);
          
          // Update database with new data
          for (const fundData of fundsData) {
            await this.updateMutualFundInDatabase(fundData);
          }
          
          // Wait 3 seconds between batches
          await this.sleep(3000);
        } catch (error) {
          logger.error(`Error processing MF batch: ${error.message}`);
        }
      }

      this.lastMutualFundSync = new Date();
      logger.info('Mutual fund data synchronization completed');
    } catch (error) {
      logger.error('Error in mutual fund data sync:', error.message);
    }
  }

  // Update mutual fund data in database
  async updateMutualFundInDatabase(fundData) {
    try {
      const existingFund = await MutualFund.findOne({ schemeCode: fundData.schemeCode });
      
      if (existingFund) {
        // Update existing fund
        await MutualFund.findByIdAndUpdate(existingFund._id, {
          nav: fundData.nav,
          previousNav: fundData.previousNav,
          navDate: fundData.navDate,
          // Add new NAV data to history (keep last 365 days)
          $push: {
            navHistory: {
              $each: fundData.navHistory,
              $slice: -365
            }
          },
          lastUpdated: new Date()
        });
        
        logger.debug(`Updated mutual fund data for ${fundData.schemeCode}`);
      } else {
        logger.warn(`Mutual fund ${fundData.schemeCode} not found in database`);
      }
    } catch (error) {
      logger.error(`Error updating mutual fund ${fundData.schemeCode}:`, error.message);
    }
  }

  // Discover new penny stocks
  async discoverPennyStocks() {
    try {
      logger.info('Starting penny stocks discovery');

      // List of potential penny stock tickers to check
      const potentialTickers = [
        'IDEA', 'YESBANK', 'SUZLON', 'RPOWER', 'JPASSOCIAT',
        'ZEEL', 'SAIL', 'COALINDIA', 'ONGC', 'IOB',
        // Add more tickers as needed
      ];

      for (const ticker of potentialTickers) {
        try {
          const stockData = await nseService.getStockData(ticker);
          
          // Check if it's a penny stock (price <= ₹50)
          if (stockData.currentPrice <= 50) {
            await this.addPennyStockToDatabase(stockData);
          }
        } catch (error) {
          logger.warn(`Could not fetch data for potential penny stock ${ticker}: ${error.message}`);
        }
        
        // Wait 1 second between requests
        await this.sleep(1000);
      }

      logger.info('Penny stocks discovery completed');
    } catch (error) {
      logger.error('Error in penny stocks discovery:', error.message);
    }
  }

  // Add penny stock to database
  async addPennyStockToDatabase(stockData) {
    try {
      const existingStock = await Stock.findOne({ ticker: stockData.ticker });
      
      if (!existingStock) {
        // Add new penny stock
        const newStock = new Stock({
          ...stockData,
          sector: this.guessSector(stockData.name),
          industry: this.guessIndustry(stockData.name),
          isPennyStock: true,
          isActive: true
        });
        
        await newStock.save();
        logger.info(`Added new penny stock: ${stockData.ticker} - ${stockData.name}`);
      }
    } catch (error) {
      logger.error(`Error adding penny stock ${stockData.ticker}:`, error.message);
    }
  }

  // Helper method to guess sector from company name
  guessSector(companyName) {
    const name = companyName.toLowerCase();
    
    if (name.includes('bank') || name.includes('financial')) return 'Banking';
    if (name.includes('power') || name.includes('energy')) return 'Power';
    if (name.includes('steel') || name.includes('metal')) return 'Metal';
    if (name.includes('telecom') || name.includes('communication')) return 'Telecommunications';
    if (name.includes('pharma') || name.includes('healthcare')) return 'Pharmaceuticals';
    if (name.includes('auto') || name.includes('motor')) return 'Automobile';
    if (name.includes('it') || name.includes('software')) return 'Information Technology';
    
    return 'Others';
  }

  // Helper method to guess industry
  guessIndustry(companyName) {
    const name = companyName.toLowerCase();
    
    if (name.includes('private bank') || name.includes('pvt bank')) return 'Private Banking';
    if (name.includes('public bank') || name.includes('govt bank')) return 'Public Banking';
    if (name.includes('thermal power')) return 'Thermal Power';
    if (name.includes('renewable') || name.includes('solar')) return 'Renewable Energy';
    
    return 'Diversified';
  }

  // Helper method to sleep/wait
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get sync status
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastStockSync: this.lastStockSync,
      lastMutualFundSync: this.lastMutualFundSync
    };
  }

  // Force sync (for manual triggers)
  async forceSyncStocks() {
    await this.syncStockData();
  }

  async forceSyncMutualFunds() {
    await this.syncMutualFundData();
  }
}

module.exports = new DataSyncService();
