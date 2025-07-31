const mongoose = require('mongoose');
const logger = require('./logger');

const connectDatabase = async () => {
  try {
    // Debug: Log the connection string (without password)
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    // Log connection attempt (hide password for security)
    const safeUri = uri.replace(/:([^:@]+)@/, ':****@');
    logger.info(`Attempting to connect to MongoDB: ${safeUri}`);

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      connectTimeoutMS: 30000, // 30 seconds timeout
      bufferCommands: false,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return conn;

  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    
    // Additional debugging information
    if (error.name === 'MongoServerSelectionError') {
      logger.error('Possible causes:');
      logger.error('1. Network connectivity issues');
      logger.error('2. IP address not whitelisted in MongoDB Atlas');
      logger.error('3. Incorrect connection string format');
      logger.error('4. Database user permissions');
    }
    
    throw error;
  }
};

module.exports = connectDatabase;
