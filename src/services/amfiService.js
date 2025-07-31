const axios = require('axios');
const logger = require('../utils/logger');

class AMFIService {
  constructor() {
    this.mfApiBase = 'https://api.mfapi.in';
    this.captnemoApiBase = 'https://mf.captnemo.in';
    this.timeout = 15000;
  }

  // Fixed: Convert DD-MM-YYYY to proper Date object
  parseValidDate(dateInput) {
    try {
      if (!dateInput) {
        return new Date();
      }
      
      const dateString = dateInput.toString().trim();
      
      // Check if it's in DD-MM-YYYY format (Indian format)
      const ddmmyyyyPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      const match = dateString.match(ddmmyyyyPattern);
      
      if (match) {
        const [, day, month, year] = match;
        // Convert to ISO format: YYYY-MM-DD
        const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const parsedDate = new Date(isoDateString);
        
        // Validate if the date is valid
        if (!isNaN(parsedDate.getTime())) {
          logger.info(`✅ Converted ${dateString} to ${isoDateString}`);
          return parsedDate;
        }
      }
      
      // Try parsing as is (for other formats)
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
      
      // If all parsing fails, use current date as last resort
      console.warn(`Could not parse date: ${dateInput}, using current date`);
      return new Date();
      
    } catch (error) {
      console.warn(`Date parsing failed for ${dateInput}:`, error.message);
      return new Date();
    }
  }

  // Alternative method: More explicit conversion
  convertDDMMYYYYtoISO(dateString) {
    try {
      // Split the DD-MM-YYYY string
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        
        // Validate parts
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        if (dayNum >= 1 && dayNum <= 31 && 
            monthNum >= 1 && monthNum <= 12 && 
            yearNum >= 1900 && yearNum <= 2100) {
          
          // Create ISO format string: YYYY-MM-DD
          const isoDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
          
          // Validate by creating Date object
          const dateObj = new Date(isoDate);
          if (!isNaN(dateObj.getTime())) {
            return dateObj;
          }
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Updated: Format NAV history with proper date conversion
  formatNavHistory(navData) {
    if (!navData || !Array.isArray(navData)) {
      return [];
    }

    return navData.slice(0, 365).map(item => {
      // Use the improved date parsing
      let validDate = this.convertDDMMYYYYtoISO(item.date);
      
      if (!validDate) {
        validDate = this.parseValidDate(item.date);
      }
      
      const validNav = parseFloat(item.nav) || 0;
      
      return {
        date: validDate,
        nav: validNav
      };
    }).filter(item => {
      // Filter out invalid entries
      return item.date instanceof Date && 
             !isNaN(item.date.getTime()) && 
             item.nav > 0;
    });
  }

  async getMutualFundData(schemeCode) {
    try {
      logger.info(`Fetching mutual fund data for scheme: ${schemeCode}`);

      const response = await axios.get(
        `${this.mfApiBase}/mf/${schemeCode}`,
        { timeout: this.timeout }
      );

      const data = response.data;
      const metaData = data.meta;
      const navData = data.data;

      if (!navData || navData.length === 0) {
        throw new Error('No NAV data available');
      }

      const currentNav = parseFloat(navData[0].nav);
      const previousNav = navData.length > 1 ? parseFloat(navData[1].nav) : currentNav;
      const navChange = currentNav - previousNav;
      const navChangePercent = previousNav !== 0 ? ((navChange / previousNav) * 100) : 0;

      const fundHouse = metaData.fund_house.replace(/_MF$|MUTUALFUND_MF$/, '').replace(/_/g, ' ');

      return {
        schemeCode: metaData.scheme_code,
        schemeName: metaData.scheme_name,
        fundHouse: fundHouse,
        nav: currentNav,
        previousNav: previousNav,
        navChange: parseFloat(navChange.toFixed(4)),
        navChangePercent: parseFloat(navChangePercent.toFixed(2)),
        navDate: this.parseValidDate(navData[0].date),
        category: this.categorizeFund(metaData.scheme_name),
        subCategory: this.getSubCategory(metaData.scheme_name),
        navHistory: this.formatNavHistory(navData),
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error(`Error fetching mutual fund data for ${schemeCode}:`, error.message);
      throw new Error(`Failed to fetch data for scheme ${schemeCode}`);
    }
  }

  // ... rest of your existing methods remain the same
  categorizeFund(schemeName) {
    const name = schemeName.toLowerCase();
    
    if (name.includes('debt') || name.includes('bond') || name.includes('gilt')) {
      return 'Debt';
    } else if (name.includes('hybrid') || name.includes('balanced')) {
      return 'Hybrid';
    } else if (name.includes('equity') || name.includes('growth') || name.includes('value')) {
      return 'Equity';
    } else if (name.includes('index') || name.includes('etf')) {
      return 'Index';
    } else {
      return 'Other';
    }
  }

  getSubCategory(schemeName) {
    const name = schemeName.toLowerCase();
    
    if (name.includes('large cap') || name.includes('bluechip')) {
      return 'Large Cap';
    } else if (name.includes('mid cap')) {
      return 'Mid Cap';
    } else if (name.includes('small cap')) {
      return 'Small Cap';
    } else if (name.includes('multi cap') || name.includes('flexi cap')) {
      return 'Multi Cap';
    } else if (name.includes('sectoral') || name.includes('thematic')) {
      return 'Sectoral/Thematic';
    } else {
      return 'Diversified';
    }
  }

  async getMultipleMutualFunds(schemeCodes) {
    try {
      logger.info(`Fetching data for ${schemeCodes.length} mutual funds`);
      
      const promises = schemeCodes.map(schemeCode => 
        this.getMutualFundData(schemeCode).catch(error => {
          logger.warn(`Failed to fetch data for scheme ${schemeCode}: ${error.message}`);
          return null;
        })
      );

      const results = await Promise.all(promises);
      return results.filter(result => result !== null);
    } catch (error) {
      logger.error('Error fetching multiple mutual funds:', error.message);
      throw error;
    }
  }
}

module.exports = new AMFIService();
