const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class NSEService {
  constructor() {
    // Base URLs for different data sources
    this.yahooFinanceBase = 'https://query1.finance.yahoo.com/v8/finance/chart/';
    this.rapidApiBase = 'https://indian-stock-exchange.p.rapidapi.com';
    this.nseIndiaBase = 'https://www.nseindia.com/api';
    
    // Default request timeout
    this.timeout = 10000; // 10 seconds
  }

  // Helper method to add Indian stock suffix
  formatTickerForYahoo(ticker) {
    // Yahoo Finance requires .NS suffix for NSE stocks
    return ticker.includes('.') ? ticker : `${ticker}.NS`;
  }

  // Get single stock data from Yahoo Finance
  async getStockData(ticker) {
    try {
      const formattedTicker = this.formatTickerForYahoo(ticker);
      logger.info(`Fetching stock data for: ${formattedTicker}`);

      const response = await axios.get(
        `${this.yahooFinanceBase}${formattedTicker}?interval=1d&range=1y`,
        {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const data = response.data.chart.result[0];
      const meta = data.meta;
      const quotes = data.indicators.quote[0];
      
      // Extract current price and calculate changes
      const currentPrice = meta.regularMarketPrice || quotes.close[quotes.close.length - 1];
      const previousClose = meta.previousClose || quotes.close[quotes.close.length - 2];
      const change = currentPrice - previousClose;
      const changePercent = ((change / previousClose) * 100);

      // Format the data according to our Stock model
      return {
        ticker: ticker.toUpperCase(),
        name: meta.longName || meta.shortName || ticker,
        exchange: 'NSE',
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        previousClose: parseFloat(previousClose.toFixed(2)),
        dayChange: parseFloat(change.toFixed(2)),
        dayChangePercent: parseFloat(changePercent.toFixed(2)),
        volume: quotes.volume[quotes.volume.length - 1] || 0,
        high52Week: meta.fiftyTwoWeekHigh || null,
        low52Week: meta.fiftyTwoWeekLow || null,
        marketCap: meta.marketCap || null,
        lastUpdated: new Date(),
        // Generate price history from the data
        priceHistory: this.formatPriceHistory(data.timestamp, quotes)
      };
    } catch (error) {
      logger.error(`Error fetching stock data for ${ticker}:`, error.message);
      throw new Error(`Failed to fetch data for ${ticker}`);
    }
  }

  // Format price history data
  formatPriceHistory(timestamps, quotes) {
    const history = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] && quotes.close[i]) {
        history.push({
          date: new Date(timestamps[i] * 1000),
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i] || 0
        });
      }
    }
    
    // Return last 90 days of data
    return history.slice(-90);
  }

  // Get multiple stocks data
  async getMultipleStocks(tickers) {
    try {
      logger.info(`Fetching data for ${tickers.length} stocks`);
      
      const promises = tickers.map(ticker => 
        this.getStockData(ticker).catch(error => {
          logger.warn(`Failed to fetch data for ${ticker}: ${error.message}`);
          return null; // Return null for failed requests
        })
      );

      const results = await Promise.all(promises);
      
      // Filter out null results (failed requests)
      return results.filter(result => result !== null);
    } catch (error) {
      logger.error('Error fetching multiple stocks:', error.message);
      throw error;
    }
  }

  // Get market indices (NIFTY, SENSEX, etc.)
  async getMarketIndices() {
    try {
      logger.info('Fetching market indices data');
      
      // List of major Indian indices with their Yahoo Finance symbols
      const indices = [
        { symbol: '^NSEI', name: 'NIFTY 50' },
        { symbol: '^BSESN', name: 'BSE SENSEX' },
        { symbol: '^NSEBANK', name: 'NIFTY BANK' },
        { symbol: '^CNXIT', name: 'NIFTY IT' }
      ];

      const promises = indices.map(async (index) => {
        try {
          const response = await axios.get(
            `${this.yahooFinanceBase}${index.symbol}?interval=1d&range=5d`,
            {
              timeout: this.timeout,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }
          );

          const data = response.data.chart.result[0];
          const meta = data.meta;
          const quotes = data.indicators.quote[0];
          
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose;
          const change = currentPrice - previousClose;
          const changePercent = ((change / previousClose) * 100);

          return {
            name: index.name,
            symbol: index.symbol,
            value: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            lastUpdated: new Date()
          };
        } catch (error) {
          logger.warn(`Failed to fetch data for ${index.name}:`, error.message);
          return null;
        }
      });

      const results = await Promise.all(promises);
      return results.filter(result => result !== null);
    } catch (error) {
      logger.error('Error fetching market indices:', error.message);
      throw error;
    }
  }

  // Search stocks by name or ticker
  async searchStocks(query) {
    try {
      logger.info(`Searching stocks with query: ${query}`);
      
      // Use Yahoo Finance search endpoint
      const response = await axios.get(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`,
        {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const quotes = response.data.quotes || [];
      
      // Filter for Indian stocks (those with .NS, .BO suffix or Indian exchanges)
      const indianStocks = quotes.filter(quote => 
        quote.symbol.includes('.NS') || 
        quote.symbol.includes('.BO') ||
        quote.exchange === 'NSI' ||
        quote.exchange === 'BSE'
      );

      return indianStocks.slice(0, 10).map(quote => ({
        ticker: quote.symbol.replace(/\.(NS|BO)$/, ''),
        name: quote.shortname || quote.longname,
        exchange: quote.symbol.includes('.NS') ? 'NSE' : 'BSE',
        marketCap: quote.marketCap,
        sector: quote.sector
      }));
    } catch (error) {
      logger.error(`Error searching stocks with query ${query}:`, error.message);
      return [];
    }
  }
}

module.exports = new NSEService();
