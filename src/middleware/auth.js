// ===========================================
// Authentication Middleware
// ===========================================

const { passport, verifyToken } = require('../config/auth');
const { User } = require('../models');

// JWT Authentication for API routes
const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication error',
        error: err.message 
      });
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: info?.message || 'Unauthorized - Invalid or expired token' 
      });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

// Optional JWT Authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
};

// Session-based authentication for admin panel
const requireSession = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  req.flash('error', 'Please log in to access this page');
  res.redirect('/admin/login');
};

// Verify user owns the resource
const verifyOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const resource = await model.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({ 
          success: false, 
          message: 'Resource not found' 
        });
      }
      
      if (resource.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied - You do not own this resource' 
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error verifying ownership',
        error: error.message 
      });
    }
  };
};

// Refresh token handler
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Refresh token required' 
      });
    }
    
    const decoded = verifyToken(refreshToken, true);
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid refresh token' 
      });
    }
    
    const { generateTokens } = require('../config/auth');
    const tokens = generateTokens(user);
    
    res.json({ 
      success: true, 
      ...tokens 
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired refresh token' 
    });
  }
};

module.exports = {
  authenticateJWT,
  optionalAuth,
  requireSession,
  verifyOwnership,
  refreshTokenHandler
};
