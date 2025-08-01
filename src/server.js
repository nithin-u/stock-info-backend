require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./utils/database');
const dataSyncService = require('./services/dataSync');
const websocketService = require('./services/websocketService');
const logger = require('./utils/logger');
const http = require('http');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Connect to database
connectDatabase();

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Start server
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`🌐 HTTP server available at http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket server will be available at ws://localhost:${PORT}/ws`);
  
  // Initialize WebSocket server with proper path configuration
  try {
    websocketService.initialize(server);
    logger.info('✅ WebSocket server initialized successfully');
  } catch (error) {
    logger.error('❌ WebSocket server initialization failed:', error);
  }
  
  // Initialize data sync cron jobs
  try {
    dataSyncService.initCronJobs();
    logger.info('✅ Data sync cron jobs initialized');
    logger.info('✅ Data synchronization service started');
  } catch (error) {
    logger.error('❌ Data sync initialization failed:', error);
  }
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('❌ Server error:', error);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('❌ Unhandled Rejection:', err);
  logger.info('🔄 Shutting down server due to unhandled promise rejection...');
  
  // Close server gracefully
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown for SIGTERM (production deployment)
process.on('SIGTERM', () => {
  logger.info('📡 SIGTERM received. Shutting down gracefully...');
  
  // Stop WebSocket real-time updates
  try {
    websocketService.stopRealTimeUpdates();
    logger.info('✅ WebSocket real-time updates stopped');
  } catch (error) {
    logger.error('❌ Error stopping WebSocket updates:', error);
  }
  
  // Stop data sync services
  try {
    dataSyncService.stopCronJobs();
    logger.info('✅ Data sync cron jobs stopped');
  } catch (error) {
    logger.error('❌ Error stopping data sync:', error);
  }
  
  // Close HTTP server
  server.close(() => {
    logger.info('✅ HTTP server closed');
    logger.info('🔄 Process terminated gracefully');
    process.exit(0);
  });
  
  // Force close after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('❌ Forced shutdown - graceful shutdown timeout');
    process.exit(1);
  }, 30000);
});

// Graceful shutdown for SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('⌨️ SIGINT received. Shutting down gracefully...');
  
  // Stop WebSocket real-time updates
  try {
    websocketService.stopRealTimeUpdates();
    logger.info('✅ WebSocket real-time updates stopped');
  } catch (error) {
    logger.error('❌ Error stopping WebSocket updates:', error);
  }
  
  // Stop data sync services
  try {
    dataSyncService.stopCronJobs();
    logger.info('✅ Data sync cron jobs stopped');
  } catch (error) {
    logger.error('❌ Error stopping data sync:', error);
  }
  
  // Close HTTP server
  server.close(() => {
    logger.info('✅ HTTP server closed');
    logger.info('🔄 Process terminated gracefully');
    process.exit(0);
  });
  
  // Force close after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('❌ Forced shutdown - graceful shutdown timeout');
    process.exit(1);
  }, 30000);
});

// Handle additional process signals
process.on('SIGHUP', () => {
  logger.info('📡 SIGHUP received - reloading configuration...');
  // Add any configuration reload logic here if needed
});

// Log successful startup
process.on('exit', (code) => {
  logger.info(`🔄 Process exited with code: ${code}`);
});

// Export server for testing
module.exports = server;
