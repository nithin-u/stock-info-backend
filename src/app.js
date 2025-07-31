const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

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
    // Development URLs
    'http://localhost:5173',                    // Vite dev server
    'http://localhost:3000',                    // Alternative dev port
    'http://127.0.0.1:5173',                   // Alternative localhost
    
    // Production URLs - Replace these with your actual URLs
    'https://stock-info-rouge.vercel.app/',      // Example Vercel URL
    'https://gregarious-clafoutis-07ba37.netlify.app/',     // Example Netlify URL
    
    // Environment variables (for flexibility)
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL,
    process.env.NETLIFY_URL,
    
    // You can also use regex patterns for dynamic subdomains
    /https:\/\/.*\.vercel\.app$/,               // Any Vercel app
    /https:\/\/.*\.netlify\.app$/,              // Any Netlify app
  ].filter(Boolean), // Remove undefined values
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

// Add debug logging in development
if (process.env.NODE_ENV === 'development') {
  console.log('🌐 CORS Origins:', corsOptions.origin);
}

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Development-friendly rate limiting
const isDevelopment = process.env.NODE_ENV === 'development';

// General rate limiting with higher limits for development
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000, // Much higher limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks in development
  skip: (req) => {
    return isDevelopment && (req.path === '/health' || req.path === '/');
  }
});

app.use(generalLimiter);

// Specific auth rate limiting with development considerations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 5, // Much higher for development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator to be more lenient in development
  keyGenerator: (req) => {
    if (isDevelopment) {
      return `auth_dev_${req.ip}_${Math.floor(Date.now() / 60000)}`; // Reset every minute in dev
    }
    return `auth_${req.ip}`;
  }
});

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

module.exports = app;
