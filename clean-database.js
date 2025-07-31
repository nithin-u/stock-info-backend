require('dotenv').config();
const mongoose = require('mongoose');
const MutualFund = require('./src/models/MutualFund');
const logger = require('./src/utils/logger');

async function cleanInvalidDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for cleanup');

    // Find all mutual funds with navHistory
    const funds = await MutualFund.find({});
    let totalCleaned = 0;
    
    for (const fund of funds) {
      if (fund.navHistory && fund.navHistory.length > 0) {
        const originalCount = fund.navHistory.length;
        
        // Filter out invalid dates and NAV values
        const validNavHistory = fund.navHistory.filter(item => {
          return item.date && 
                 item.date instanceof Date && 
                 !isNaN(item.date.getTime()) && 
                 item.nav && 
                 !isNaN(item.nav) &&
                 item.nav > 0;
        });

        // Update only if we removed invalid entries
        if (validNavHistory.length !== originalCount) {
          await MutualFund.findByIdAndUpdate(fund._id, {
            navHistory: validNavHistory
          });
          
          const cleanedCount = originalCount - validNavHistory.length;
          totalCleaned += cleanedCount;
          
          logger.info(`Cleaned ${fund.schemeName}: ${cleanedCount} invalid entries removed`);
        }
      }
    }

    logger.info(`✅ Database cleanup completed. Total invalid entries removed: ${totalCleaned}`);
    process.exit(0);
  } catch (error) {
    logger.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanInvalidDates();
