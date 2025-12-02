// ===========================================
// ClarityNest Backend - Main Application
// ===========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Database & Auth
const { testConnection, syncDatabase } = require('./config/database');
const { passport, initializePassport } = require('./config/auth');
const { User, Account, Transaction, Mood, Post } = require('./models');

// Routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const moodRoutes = require('./routes/moods');
const communityRoutes = require('./routes/community');
const exportRoutes = require('./routes/export');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const stripeController = require('./controllers/stripeController');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// STRIPE WEBHOOK (must be before body parsers)
// ===========================================

app.post('/api/webhook/stripe', 
  express.raw({ type: 'application/json' }), 
  stripeController.handleWebhook
);

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for admin panel EJS views
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session for admin panel
app.use(session({
  secret: process.env.SESSION_SECRET || 'claritynest-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(flash());

// Initialize Passport
initializePassport(User);
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many authentication attempts.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine for admin panel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Pass flash messages to views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.user;
  next();
});

// ===========================================
// API ROUTES
// ===========================================

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);

// ===========================================
// ADMIN PANEL ROUTES (Server-rendered)
// ===========================================

const adminPanelRouter = require('./routes/adminPanel');
app.use('/admin', adminPanelRouter);

// ===========================================
// HEALTH CHECK & ROOT
// ===========================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'ClarityNest API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      accounts: '/api/accounts',
      moods: '/api/moods',
      community: '/api/community',
      export: '/api/export',
      subscription: '/api/subscription',
      admin: '/api/admin'
    }
  });
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map(e => ({ field: e.path, message: e.message }))
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===========================================
// DATABASE SEEDING
// ===========================================

const seedDatabase = async () => {
  try {
    // Check if admin exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@claritynest.com';
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    
    if (!existingAdmin) {
      // Create admin user
      await User.create({
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
        name: 'Admin',
        role: 'admin',
        isActive: true,
        isPremium: true
      });
      console.log('✅ Admin user created:', adminEmail);
    }

    // Create demo posts if none exist
    const postCount = await Post.count();
    if (postCount === 0) {
      const demoPosts = [
        { content: "Just maxed out my Roth IRA for the year! Feels amazing.", likes: 12, category: 'win' },
        { content: "Resisted the urge to panic sell during the dip today.", likes: 8, category: 'win' },
        { content: "Finally set up autopay for all bills. Mental load gone.", likes: 24, category: 'tip' },
        { content: "Hit my first $10k net worth milestone! 🎉", likes: 45, category: 'milestone' },
        { content: "Paid off my car loan 6 months early. Freedom!", likes: 33, category: 'win' }
      ];

      // Need a user to attach posts to
      const adminUser = await User.findOne({ where: { role: 'admin' } });
      if (adminUser) {
        for (const post of demoPosts) {
          await Post.create({
            ...post,
            userId: adminUser.id,
            isAnonymous: true,
            isApproved: true
          });
        }
        console.log('✅ Demo posts created');
      }
    }
  } catch (error) {
    console.error('Seeding error:', error);
  }
};

// ===========================================
// SERVER STARTUP
// ===========================================

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Sync database models
    await syncDatabase(false); // Set to true to force recreate tables
    
    // Seed initial data
    await seedDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🌿 ClarityNest Backend Started                  ║
║                                                   ║
║   API:    http://localhost:${PORT}/api              ║
║   Admin:  http://localhost:${PORT}/admin            ║
║   Health: http://localhost:${PORT}/health           ║
║                                                   ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
