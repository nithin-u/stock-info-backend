const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ✅ ADD THIS LINE - Enable trust proxy for production deployments
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
    
    // Production - Add your actual URLs
    'https://stock-info-rouge.vercel.app',        // Your actual Vercel URL
    'https://stock-info-8jrccn4r7-nithin-us-projects.vercel.app', // Your other Vercel URL
    
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

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Development-friendly rate limiting with proxy support
const isDevelopment = process.env.NODE_ENV === 'development';

// General rate limiting with proxy trust
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000, // Much higher limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Configure for proxy environment
  trustProxy: true,
  // Skip rate limiting for health checks in development
  skip: (req) => {
    return isDevelopment && (req.path === '/health' || req.path === '/');
  }
});

app.use(generalLimiter);

// Specific auth rate limiting with proxy support
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 10, // Higher for development, reasonable for production
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ Configure for proxy environment
  trustProxy: true,
  // Custom key generator for proxy environment
  keyGenerator: (req) => {
    // Use X-Forwarded-For header in production, fallback to IP
    return req.ip || req.connection.remoteAddress;
  }
});

// Rest of your existing app.js code continues here...
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Enhanced logging middleware
if (isDevelopment) {
  app.use(morgan('dev'));
  // Log CORS requests in development
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

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🇮🇳 Stock Info India Backend API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      stocks: '/api/stocks',
      mutualFunds: '/api/mutual-funds',
      watchlists: '/api/watchlists',
      market: '/api/market'
    }
  });
});

// Apply auth rate limiter to auth routes before mounting routes
app.use('/api/auth', authLimiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/mutual-funds', require('./routes/mutualFunds'));
app.use('/api/watchlists', require('./routes/watchlist'));
app.use('/api/market', require('./routes/market'));

// 404 handler for undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
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

// Add this temporary seeding endpoint
app.get('/seed-database', async (req, res) => {
  try {
    // Only allow in development or with special token
    if (process.env.NODE_ENV === 'production' && req.query.token !== 'stock-info-seed-2024') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const seedData = require('./utils/seedData');
    await seedData();
    
    res.json({
      success: true,
      message: 'Database seeded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database seeding error:', error);
    res.status(500).json({
      success: false,
      message: 'Database seeding failed',
      error: error.message
    });
  }
});


module.exports = app;
