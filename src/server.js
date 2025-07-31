require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./utils/database');
const dataSyncService = require('./services/dataSync');
const websocketService = require('./services/websocketService');
const logger = require('./utils/logger');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Connect to database
connectDatabase();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  
  // Initialize WebSocket server
  websocketService.initialize(server);
  
  // Initialize data sync cron jobs
  dataSyncService.initCronJobs();
  logger.info('Data synchronization service started');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  websocketService.stopRealTimeUpdates();
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  websocketService.stopRealTimeUpdates();
  server.close(() => {
    logger.info('Process terminated');
  });
});
