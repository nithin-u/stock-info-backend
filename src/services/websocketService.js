const WebSocket = require('ws');
const Stock = require('../models/Stocks');
const nseService = require('./nseService');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Store client connections with metadata
    this.updateInterval = null;
    this.isRunning = false;
  }

  // Initialize WebSocket server
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        clientTracking: true
      });

      this.wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      logger.info('WebSocket server initialized on /ws path');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
    }
  }

  // Handle new WebSocket connection
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ip: req.socket.remoteAddress,
      connectedAt: new Date(),
      subscribedTickers: new Set(),
      isAlive: true
    };

    this.clients.set(ws, clientInfo);
    logger.info(`WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connection',
      status: 'connected',
      clientId: clientId,
      message: 'Connected to Stock Info India real-time data feed'
    });

    // Handle incoming messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(ws, data);
      } catch (error) {
        logger.error('Invalid WebSocket message format:', error);
        this.sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format'
        });
      }
    });

    // Handle connection close
    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client) {
        logger.info(`WebSocket client disconnected: ${client.id}`);
        this.clients.delete(ws);
      }
    });

    // Handle connection error
    ws.on('error', (error) => {
      const client = this.clients.get(ws);
      logger.error(`WebSocket error for client ${client?.id}:`, error);
    });

    // Heartbeat to keep connection alive
    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.isAlive = true;
      }
    });
  }

  // Handle messages from clients
  handleClientMessage(ws, data) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (data.type) {
      case 'subscribe':
        this.subscribeToTickers(ws, data.tickers || []);
        break;
      
      case 'unsubscribe':
        this.unsubscribeFromTickers(ws, data.tickers || []);
        break;
      
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      
      default:
        this.sendToClient(ws, {
          type: 'error',
          message: `Unknown message type: ${data.type}`
        });
    }
  }

  // Subscribe client to specific stock tickers
  subscribeToTickers(ws, tickers) {
    const client = this.clients.get(ws);
    if (!client) return;

    tickers.forEach(ticker => {
      if (typeof ticker === 'string') {
        client.subscribedTickers.add(ticker.toUpperCase());
      }
    });

    logger.info(`Client ${client.id} subscribed to: ${Array.from(client.subscribedTickers).join(', ')}`);
    
    this.sendToClient(ws, {
      type: 'subscription_success',
      subscribedTickers: Array.from(client.subscribedTickers),
      message: `Subscribed to ${tickers.length} tickers`
    });

    // Start real-time updates if not already running
    if (!this.isRunning) {
      this.startRealTimeUpdates();
    }
  }

  // Unsubscribe client from specific tickers
  unsubscribeFromTickers(ws, tickers) {
    const client = this.clients.get(ws);
    if (!client) return;

    tickers.forEach(ticker => {
      client.subscribedTickers.delete(ticker.toUpperCase());
    });

    this.sendToClient(ws, {
      type: 'unsubscription_success',
      subscribedTickers: Array.from(client.subscribedTickers),
      message: `Unsubscribed from ${tickers.length} tickers`
    });
  }

  // Start real-time price updates
  startRealTimeUpdates() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Starting real-time stock price updates');

    // Update prices every 30 seconds during market hours
    this.updateInterval = setInterval(async () => {
      await this.fetchAndBroadcastUpdates();
    }, 30000); // 30 seconds

    // Heartbeat check every 30 seconds
    setInterval(() => {
      this.performHeartbeatCheck();
    }, 30000);
  }

  // Stop real-time updates
  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    logger.info('Stopped real-time stock price updates');
  }

  // Fetch latest prices and broadcast to subscribed clients
  async fetchAndBroadcastUpdates() {
    try {
      // Get all unique tickers that clients are subscribed to
      const allSubscribedTickers = new Set();
      this.clients.forEach(client => {
        client.subscribedTickers.forEach(ticker => {
          allSubscribedTickers.add(ticker);
        });
      });

      if (allSubscribedTickers.size === 0) {
        logger.debug('No subscribed tickers, skipping price update');
        return;
      }

      const tickers = Array.from(allSubscribedTickers);
      logger.debug(`Fetching updates for ${tickers.length} tickers`);

      // Fetch updated stock data from NSE service
      const updatedStocks = await nseService.getMultipleStocks(tickers);

      // Broadcast updates to relevant clients
      for (const stockData of updatedStocks) {
        this.broadcastStockUpdate(stockData);
        
        // Update database with new price data
        await this.updateStockInDatabase(stockData);
      }

    } catch (error) {
      logger.error('Error in real-time price updates:', error);
    }
  }

  // Broadcast stock update to subscribed clients
  broadcastStockUpdate(stockData) {
    const message = {
      type: 'price_update',
      data: {
        ticker: stockData.ticker,
        currentPrice: stockData.currentPrice,
        dayChange: stockData.dayChange,
        dayChangePercent: stockData.dayChangePercent,
        volume: stockData.volume,
        timestamp: new Date().toISOString(),
        lastUpdated: stockData.lastUpdated
      }
    };

    // Send to clients subscribed to this ticker
    this.clients.forEach((client, ws) => {
      if (client.subscribedTickers.has(stockData.ticker)) {
        this.sendToClient(ws, message);
      }
    });
  }

  // Update stock data in database
  async updateStockInDatabase(stockData) {
    try {
      await Stock.findOneAndUpdate(
        { ticker: stockData.ticker },
        {
          currentPrice: stockData.currentPrice,
          previousClose: stockData.previousClose,
          dayChange: stockData.dayChange,
          dayChangePercent: stockData.dayChangePercent,
          volume: stockData.volume,
          lastUpdated: new Date()
        },
        { upsert: false }
      );
    } catch (error) {
      logger.error(`Error updating ${stockData.ticker} in database:`, error);
    }
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending message to client:', error);
      }
    }
  }

  // Perform heartbeat check on all clients
  performHeartbeatCheck() {
    this.clients.forEach((client, ws) => {
      if (!client.isAlive) {
        logger.info(`Terminating inactive client: ${client.id}`);
        ws.terminate();
        this.clients.delete(ws);
        return;
      }

      client.isAlive = false;
      ws.ping();
    });
  }

  // Generate unique client ID
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      totalClients: this.clients.size,
      isRunning: this.isRunning,
      clients: []
    };

    this.clients.forEach((client, ws) => {
      stats.clients.push({
        id: client.id,
        ip: client.ip,
        connectedAt: client.connectedAt,
        subscribedTickers: Array.from(client.subscribedTickers),
        isAlive: client.isAlive
      });
    });

    return stats;
  }
}

module.exports = new WebSocketService();
