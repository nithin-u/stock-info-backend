require('dotenv').config();
const connectDatabase = require('./database.js');
const Stock = require('../models/Stocks.js');
const MutualFund = require('../models/MutualFund.js');
const nseService = require('../services/nseService.js');
const amfiService = require('../services/amfiService.js');
const logger = require('./logger.js');

class DataSeeder {
  constructor() {
    this.pennyStockTickers = [
  // Telecom
  'IDEA', 'YESBANK', 'RCOM', 'GTL', 'GTLINFRA',
  // Infrastructure & Construction  
  'JPASSOCIAT', 'RPOWER', 'SUZLON', 'JPINFRATEC', 'JKPAPER',
  // Banking & Finance
  'DHFL', 'RELCAPITAL', 'SBIN', 'IDBIGOLD', 'SOUTHBANK',
  // Steel & Metals
  'JINDALSTEL', 'SAIL', 'HINDALCO', 'TATASTEEL', 'JSWSTEEL',
  // Pharma & Healthcare
  'SUNPHARMA', 'CIPLA', 'DRREDDY', 'LUPIN', 'BIOCON',
  // Auto & Components
  'TATAMOTORS', 'BAJAJ-AUTO', 'MARUTI', 'HEROMOTOCO', 'TVSMOTORS',
  // IT & Services
  'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM',
  // Additional penny stocks under ₹50
  'PCJEWELLER', 'RELAINFRA', 'JAIHINDPRO', 'LANCO', 'GMM',
  'ORIENTREF', 'SPICEJET', 'JETAIRWAYS', 'ASHOKLEY', 'HINDCOPPER'
];

    
   this.popularMutualFundSchemes = [
  // SBI Mutual Funds
  '120503', '118273', '125497', '119223', '118989',
  // HDFC Mutual Funds  
  '101206', '101271', '101208', '101234', '101267',
  // ICICI Prudential
  '120716', '120717', '120718', '120719', '120720',
  // Axis Mutual Funds
  '120465', '120466', '120467', '120468', '120469',
  // Reliance Mutual Funds
  '100124', '100125', '100126', '100127', '100128',
  // DSP Mutual Funds
  '100940', '100941', '100942', '100943', '100944',
  // Kotak Mutual Funds
  '101145', '101146', '101147', '101148', '101149',
  // UTI Mutual Funds
  '100023', '100024', '100025', '100026', '100027'
];

  }

  async seedStocks() {
    try {
      logger.info('Starting to seed penny stocks data');

      for (const ticker of this.pennyStockTickers) {
        try {
          logger.info(`Fetching data for ${ticker}`);
          
          const stockData = await nseService.getStockData(ticker);
          
          const existingStock = await Stock.findOne({ ticker: stockData.ticker });
          
          if (existingStock) {
            logger.info(`Stock ${ticker} already exists, updating data`);
            await Stock.findByIdAndUpdate(existingStock._id, {
              ...stockData,
              lastUpdated: new Date()
            });
          } else {
            logger.info(`Adding new stock ${ticker}`);
            
            const newStock = new Stock({
              ...stockData,
              sector: this.getSector(ticker),
              industry: this.getIndustry(ticker),
              companyInfo: {
                description: this.getDescription(ticker),
                headquarters: this.getHeadquarters(ticker)
              }
            });
            
            await newStock.save();
          }
          
          // Wait 1 second between API calls
          await this.sleep(1000);
        } catch (error) {
          logger.error(`Error seeding stock ${ticker}: ${error.message}`);
        }
      }

      logger.info('Stock seeding completed');
    } catch (error) {
      logger.error('Error in stock seeding:', error.message);
    }
  }

  async seedMutualFunds() {
    try {
      logger.info('Starting to seed mutual funds data');

      for (const schemeCode of this.popularMutualFundSchemes) {
        try {
          logger.info(`Fetching data for scheme ${schemeCode}`);
          
          const fundData = await amfiService.getMutualFundData(schemeCode);
          
          const existingFund = await MutualFund.findOne({ schemeCode: fundData.schemeCode });
          
          if (existingFund) {
            logger.info(`Fund ${schemeCode} already exists, updating data`);
            
            // Fixed: Filter valid NAV history before updating
            const validNavHistory = fundData.navHistory.filter(item => {
              return item.date && 
                     item.date instanceof Date && 
                     !isNaN(item.date.getTime()) && 
                     item.nav && 
                     !isNaN(item.nav) &&
                     item.nav > 0;
            });

            await MutualFund.findByIdAndUpdate(existingFund._id, {
              nav: fundData.nav,
              previousNav: fundData.previousNav,
              navChange: fundData.navChange,
              navChangePercent: fundData.navChangePercent,
              navDate: fundData.navDate,
              lastUpdated: new Date(),
              // Only update with valid nav history
              $push: {
                navHistory: {
                  $each: validNavHistory.slice(0, 50), // Limit to 50 recent entries
                  $slice: -365
                }
              }
            });
            
            logger.info(`Updated fund ${schemeCode} with ${validNavHistory.length} valid NAV entries`);
          } else {
            logger.info(`Adding new mutual fund ${schemeCode}`);
            
            // Filter valid NAV history before creating
            const validNavHistory = fundData.navHistory.filter(item => {
              return item.date && 
                     item.date instanceof Date && 
                     !isNaN(item.date.getTime()) && 
                     item.nav && 
                     !isNaN(item.nav) &&
                     item.nav > 0;
            });

            const newFund = new MutualFund({
              ...fundData,
              navHistory: validNavHistory.slice(0, 50), // Limit initial history
              isActive: true
            });
            
            await newFund.save();
            logger.info(`Created fund ${schemeCode} with ${validNavHistory.length} valid NAV entries`);
          }
          
          // Wait 2 seconds between API calls
          await this.sleep(2000);
        } catch (error) {
          logger.error(`Error seeding mutual fund ${schemeCode}: ${error.message}`);
        }
      }

      logger.info('Mutual fund seeding completed');
    } catch (error) {
      logger.error('Error in mutual fund seeding:', error.message);
    }
  }

  getSector(ticker) {
    const sectors = {
      'IDEA': 'Telecommunications',
      'YESBANK': 'Banking',
      'SUZLON': 'Renewable Energy',
      'RPOWER': 'Power',
      'JPASSOCIAT': 'Construction'
    };
    return sectors[ticker] || 'Others';
  }

  getIndustry(ticker) {
    const industries = {
      'IDEA': 'Wireless Telecommunications',
      'YESBANK': 'Private Sector Bank',
      'SUZLON': 'Wind Energy Equipment',
      'RPOWER': 'Thermal Power Generation',
      'JPASSOCIAT': 'Infrastructure Development'
    };
    return industries[ticker] || 'Diversified';
  }

  getDescription(ticker) {
    const descriptions = {
      'IDEA': 'Vodafone Idea Limited provides telecommunications services in India.',
      'YESBANK': 'Yes Bank Limited provides banking and financial services in India.',
      'SUZLON': 'Suzlon Energy Limited provides renewable energy solutions.',
      'RPOWER': 'Reliance Power Limited is engaged in generation and supply of electricity.',
      'JPASSOCIAT': 'Jaiprakash Associates Limited is engaged in engineering and construction.'
    };
    return descriptions[ticker] || `${ticker} is an Indian company listed on NSE.`;
  }

  getHeadquarters(ticker) {
    const headquarters = {
      'IDEA': 'Mumbai, Maharashtra',
      'YESBANK': 'Mumbai, Maharashtra',
      'SUZLON': 'Pune, Maharashtra',
      'RPOWER': 'Mumbai, Maharashtra',
      'JPASSOCIAT': 'Noida, Uttar Pradesh'
    };
    return headquarters[ticker] || 'Mumbai, Maharashtra';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function seedDatabase() {
  try {
    logger.info('Starting database seeding process');
    
    await connectDatabase();
    
    const seeder = new DataSeeder();
    
    await seeder.seedStocks();
    await seeder.seedMutualFunds();
    
    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = DataSeeder;