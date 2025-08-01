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
      logger.info('🏢 Starting to seed penny stocks data');
      let successCount = 0;
      let errorCount = 0;

      for (const ticker of this.pennyStockTickers) {
        try {
          logger.info(`📊 Fetching data for ${ticker}`);
          
          // Check if nseService exists and has getStockData method
          if (!nseService || typeof nseService.getStockData !== 'function') {
            logger.warn(`⚠️ NSE service not available, creating mock data for ${ticker}`);
            
            // Create mock stock data if service is unavailable
            const mockStockData = this.createMockStockData(ticker);
            
            const existingStock = await Stock.findOne({ ticker: ticker });
            
            if (existingStock) {
              logger.info(`📝 Stock ${ticker} already exists, updating data`);
              await Stock.findByIdAndUpdate(existingStock._id, {
                ...mockStockData,
                lastUpdated: new Date()
              });
            } else {
              logger.info(`➕ Adding new stock ${ticker}`);
              const newStock = new Stock(mockStockData);
              await newStock.save();
            }
            
            successCount++;
          } else {
            // Use real NSE service
            const stockData = await nseService.getStockData(ticker);
            
            const existingStock = await Stock.findOne({ ticker: stockData.ticker });
            
            if (existingStock) {
              logger.info(`📝 Stock ${ticker} already exists, updating data`);
              await Stock.findByIdAndUpdate(existingStock._id, {
                ...stockData,
                lastUpdated: new Date()
              });
            } else {
              logger.info(`➕ Adding new stock ${ticker}`);
              
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
            
            successCount++;
          }
          
          // Wait 1 second between API calls to avoid rate limiting
          await this.sleep(1000);
          
        } catch (error) {
          errorCount++;
          logger.error(`❌ Error seeding stock ${ticker}:`, {
            message: error.message,
            stack: error.stack
          });
          
          // Continue with next stock instead of failing completely
          continue;
        }
      }

      logger.info(`✅ Stock seeding completed: ${successCount} successful, ${errorCount} errors`);
      return { stocks: successCount, stockErrors: errorCount };
      
    } catch (error) {
      logger.error('❌ Critical error in stock seeding:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async seedMutualFunds() {
    try {
      logger.info('💰 Starting to seed mutual funds data');
      let successCount = 0;
      let errorCount = 0;

      for (const schemeCode of this.popularMutualFundSchemes) {
        try {
          logger.info(`📈 Fetching data for scheme ${schemeCode}`);
          
          // Check if amfiService exists and has getMutualFundData method
          if (!amfiService || typeof amfiService.getMutualFundData !== 'function') {
            logger.warn(`⚠️ AMFI service not available, creating mock data for ${schemeCode}`);
            
            // Create mock mutual fund data if service is unavailable
            const mockFundData = this.createMockMutualFundData(schemeCode);
            
            const existingFund = await MutualFund.findOne({ schemeCode: schemeCode });
            
            if (existingFund) {
              logger.info(`📝 Fund ${schemeCode} already exists, updating data`);
              await MutualFund.findByIdAndUpdate(existingFund._id, {
                ...mockFundData,
                lastUpdated: new Date()
              });
            } else {
              logger.info(`➕ Adding new mutual fund ${schemeCode}`);
              const newFund = new MutualFund(mockFundData);
              await newFund.save();
            }
            
            successCount++;
          } else {
            // Use real AMFI service
            const fundData = await amfiService.getMutualFundData(schemeCode);
            
            const existingFund = await MutualFund.findOne({ schemeCode: fundData.schemeCode });
            
            if (existingFund) {
              logger.info(`📝 Fund ${schemeCode} already exists, updating data`);
              
              // Filter valid NAV history before updating
              const validNavHistory = (fundData.navHistory || []).filter(item => {
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
              
              logger.info(`📝 Updated fund ${schemeCode} with ${validNavHistory.length} valid NAV entries`);
            } else {
              logger.info(`➕ Adding new mutual fund ${schemeCode}`);
              
              // Filter valid NAV history before creating
              const validNavHistory = (fundData.navHistory || []).filter(item => {
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
              logger.info(`➕ Created fund ${schemeCode} with ${validNavHistory.length} valid NAV entries`);
            }
            
            successCount++;
          }
          
          // Wait 2 seconds between API calls to avoid rate limiting
          await this.sleep(2000);
          
        } catch (error) {
          errorCount++;
          logger.error(`❌ Error seeding mutual fund ${schemeCode}:`, {
            message: error.message,
            stack: error.stack
          });
          
          // Continue with next fund instead of failing completely
          continue;
        }
      }

      logger.info(`✅ Mutual fund seeding completed: ${successCount} successful, ${errorCount} errors`);
      return { mutualFunds: successCount, mutualFundErrors: errorCount };
      
    } catch (error) {
      logger.error('❌ Critical error in mutual fund seeding:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Create mock stock data when real API is unavailable
  createMockStockData(ticker) {
    const basePrice = Math.random() * 45 + 5; // Random price between ₹5-₹50
    const change = (Math.random() - 0.5) * 4; // Random change between -2 to +2
    
    return {
      ticker: ticker,
      name: this.getCompanyName(ticker),
      currentPrice: parseFloat(basePrice.toFixed(2)),
      previousClose: parseFloat((basePrice - change).toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(((change / (basePrice - change)) * 100).toFixed(2)),
      high: parseFloat((basePrice + Math.random() * 2).toFixed(2)),
      low: parseFloat((basePrice - Math.random() * 2).toFixed(2)),
      volume: Math.floor(Math.random() * 1000000) + 10000,
      marketCap: Math.floor(Math.random() * 10000) + 1000,
      sector: this.getSector(ticker),
      industry: this.getIndustry(ticker),
      exchange: 'NSE',
      isPennyStock: basePrice < 50,
      lastUpdated: new Date(),
      companyInfo: {
        description: this.getDescription(ticker),
        headquarters: this.getHeadquarters(ticker)
      }
    };
  }

  // Create mock mutual fund data when real API is unavailable
  createMockMutualFundData(schemeCode) {
    const baseNav = Math.random() * 100 + 10; // Random NAV between ₹10-₹110
    const change = (Math.random() - 0.5) * 2; // Random change between -1 to +1
    
    return {
      schemeCode: schemeCode,
      schemeName: this.getMutualFundName(schemeCode),
      nav: parseFloat(baseNav.toFixed(4)),
      previousNav: parseFloat((baseNav - change).toFixed(4)),
      navChange: parseFloat(change.toFixed(4)),
      navChangePercent: parseFloat(((change / (baseNav - change)) * 100).toFixed(2)),
      navDate: new Date(),
      fundHouse: this.getFundHouse(schemeCode),
      category: this.getFundCategory(schemeCode),
      aum: Math.floor(Math.random() * 10000) + 500,
      expenseRatio: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      isActive: true,
      lastUpdated: new Date(),
      navHistory: this.generateMockNavHistory(baseNav)
    };
  }

  // Generate mock NAV history
  generateMockNavHistory(currentNav) {
    const history = [];
    let nav = currentNav;
    
    for (let i = 30; i >= 0; i--) {
      nav = nav + (Math.random() - 0.5) * 2; // Random walk
      history.push({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // i days ago
        nav: parseFloat(Math.max(nav, 10).toFixed(4)) // Minimum NAV of 10
      });
    }
    
    return history;
  }

  getCompanyName(ticker) {
    const names = {
      'IDEA': 'Vodafone Idea Limited',
      'YESBANK': 'Yes Bank Limited',
      'SUZLON': 'Suzlon Energy Limited',
      'RPOWER': 'Reliance Power Limited',
      'JPASSOCIAT': 'Jaiprakash Associates Limited',
      'TCS': 'Tata Consultancy Services',
      'INFY': 'Infosys Limited',
      'RELIANCE': 'Reliance Industries Limited'
    };
    return names[ticker] || `${ticker} Limited`;
  }

  getMutualFundName(schemeCode) {
    const names = {
      '120503': 'SBI Bluechip Fund - Growth',
      '118273': 'SBI Small Cap Fund - Growth',
      '101206': 'HDFC Top 100 Fund - Growth',
      '120716': 'ICICI Prudential Bluechip Fund - Growth'
    };
    return names[schemeCode] || `Mutual Fund Scheme ${schemeCode}`;
  }

  getFundHouse(schemeCode) {
    if (schemeCode.startsWith('120')) return 'SBI Mutual Fund';
    if (schemeCode.startsWith('101')) return 'HDFC Mutual Fund';
    if (schemeCode.startsWith('100')) return 'UTI Mutual Fund';
    return 'Generic Fund House';
  }

  getFundCategory(schemeCode) {
    const categories = ['Large Cap', 'Mid Cap', 'Small Cap', 'Multi Cap', 'Sectoral'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  getSector(ticker) {
    const sectors = {
      'IDEA': 'Telecommunications',
      'YESBANK': 'Banking',
      'SUZLON': 'Renewable Energy',
      'RPOWER': 'Power',
      'JPASSOCIAT': 'Construction',
      'TCS': 'Information Technology',
      'INFY': 'Information Technology',
      'RELIANCE': 'Oil & Gas'
    };
    return sectors[ticker] || 'Others';
  }

  getIndustry(ticker) {
    const industries = {
      'IDEA': 'Wireless Telecommunications',
      'YESBANK': 'Private Sector Bank',
      'SUZLON': 'Wind Energy Equipment',
      'RPOWER': 'Thermal Power Generation',
      'JPASSOCIAT': 'Infrastructure Development',
      'TCS': 'IT Services',
      'INFY': 'Software Services'
    };
    return industries[ticker] || 'Diversified';
  }

  getDescription(ticker) {
    const descriptions = {
      'IDEA': 'Vodafone Idea Limited provides telecommunications services in India.',
      'YESBANK': 'Yes Bank Limited provides banking and financial services in India.',
      'SUZLON': 'Suzlon Energy Limited provides renewable energy solutions.',
      'RPOWER': 'Reliance Power Limited is engaged in generation and supply of electricity.',
      'JPASSOCIAT': 'Jaiprakash Associates Limited is engaged in engineering and construction.',
      'TCS': 'Tata Consultancy Services is a multinational IT services company.',
      'INFY': 'Infosys Limited is a global leader in consulting and IT services.'
    };
    return descriptions[ticker] || `${ticker} is an Indian company listed on NSE.`;
  }

  getHeadquarters(ticker) {
    const headquarters = {
      'IDEA': 'Mumbai, Maharashtra',
      'YESBANK': 'Mumbai, Maharashtra',
      'SUZLON': 'Pune, Maharashtra',
      'RPOWER': 'Mumbai, Maharashtra',
      'JPASSOCIAT': 'Noida, Uttar Pradesh',
      'TCS': 'Mumbai, Maharashtra',
      'INFY': 'Bengaluru, Karnataka'
    };
    return headquarters[ticker] || 'Mumbai, Maharashtra';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Main seeding function that can be called from app.js
  async execute() {
    try {
      logger.info('🌱 Starting database seeding process');
      
      // Ensure database connection
      await connectDatabase();
      
      const stockResult = await this.seedStocks();
      const mutualFundResult = await this.seedMutualFunds();
      
      const totalSuccess = stockResult.stocks + mutualFundResult.mutualFunds;
      const totalErrors = stockResult.stockErrors + mutualFundResult.mutualFundErrors;
      
      logger.info('✅ Database seeding completed successfully');
      
      return {
        success: true,
        stocksSeeded: stockResult.stocks,
        mutualFundsSeeded: mutualFundResult.mutualFunds,
        totalRecords: totalSuccess,
        totalErrors: totalErrors,
        message: `Successfully seeded ${totalSuccess} records with ${totalErrors} errors`
      };
      
    } catch (error) {
      logger.error('❌ Database seeding failed:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Function that app.js can call directly
async function seedDatabase() {
  const seeder = new DataSeeder();
  return await seeder.execute();
}

// Allow running as standalone script
async function runStandalone() {
  try {
    await seedDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runStandalone();
}

// Export both the class and the function for flexibility
module.exports = seedDatabase;
module.exports.DataSeeder = DataSeeder;
