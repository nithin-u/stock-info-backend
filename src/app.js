const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ✅ Enable trust proxy for production deployments
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Enhanced CORS configuration for multiple environments
const corsOptions = {
  origin: [
    // Development
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    
    // Production - Your actual URLs
    'https://stock-info-rouge.vercel.app',
    'https://stock-info-8jrccn4r7-nithin-us-projects.vercel.app',
    
    // Dynamic patterns for any subdomain
    /https:\/\/.*\.vercel\.app$/,
    /https:\/\/.*\.netlify\.app$/,
    
    // Environment variables
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Development-friendly rate limiting
const isDevelopment = process.env.NODE_ENV === 'development';

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  skip: (req) => {
    return isDevelopment && (req.path === '/health' || req.path === '/' || req.path === '/seed-database');
  }
});

app.use(generalLimiter);

// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 10,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (isDevelopment) {
  app.use(morgan('dev'));
  app.use((req, res, next) => {
    console.log(`🌐 CORS: ${req.method} ${req.path} from ${req.get('Origin') || 'unknown'}`);
    next();
  });
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Stock Info API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    cors: {
      allowedOrigins: corsOptions.origin.length,
      credentials: corsOptions.credentials
    },
    proxy: {
      trustProxy: app.get('trust proxy'),
      clientIP: req.ip
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🇮🇳 Stock Info India Backend API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      seedDatabase: '/seed-database', // ✅ Added to available endpoints
      auth: '/api/auth',
      stocks: '/api/stocks',
      mutualFunds: '/api/mutual-funds',
      watchlists: '/api/watchlists',
      market: '/api/market'
    }
  });
});

// ✅ MOVE DATABASE SEEDING ROUTE BEFORE API ROUTES AND 404 HANDLER
app.get('/seed-database', async (req, res) => {
  try {
    logger.info('🌱 Database seeding request received');
    
    // Security check - Updated token to match your URL
    if (process.env.NODE_ENV === 'production' && req.query.token !== 'stock-info-seed-2025') {
      logger.warn('❌ Unauthorized seed attempt with token:', req.query.token);
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied - Invalid or missing token' 
      });
    }

    logger.info('✅ Token validated, starting database seeding...');
    
    // Import and execute seeding
    const seedData = require('./utils/seedData');
    const result = await seedData();
    
    logger.info('✅ Database seeding completed successfully');
    
    res.json({
      success: true,
      message: 'Database seeded successfully',
      data: result,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
    
  } catch (error) {
    logger.error('❌ Database seeding error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Database seeding failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Apply auth rate limiter to auth routes
app.use('/api/auth', authLimiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/mutual-funds', require('./routes/mutualFunds'));
app.use('/api/watchlists', require('./routes/watchlist'));
app.use('/api/market', require('./routes/market'));

// ✅ 404 handler MUST be AFTER all route definitions
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/seed-database', // ✅ Added to available routes list
      '/api/auth/*',
      '/api/stocks/*',
      '/api/mutual-funds/*',
      '/api/watchlists/*',
      '/api/market/*'
    ]
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
