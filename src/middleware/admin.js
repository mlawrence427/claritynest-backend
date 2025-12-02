// ===========================================
// Admin Middleware - Role-based access control
// ===========================================

// Require admin role for API routes
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  
  next();
};

// Require admin role for session-based routes (admin dashboard)
const requireAdminSession = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    req.flash('error', 'Please log in to access this page');
    return res.redirect('/admin/login');
  }
  
  if (req.user.role !== 'admin') {
    req.flash('error', 'Admin access required');
    return res.redirect('/admin/login');
  }
  
  next();
};

// Check if user has premium access
const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  if (!req.user.isPremium && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Premium subscription required',
      upgradeUrl: '/api/subscription/plans'
    });
  }
  
  // Check if premium has expired
  if (req.user.premiumExpiresAt && new Date(req.user.premiumExpiresAt) < new Date()) {
    return res.status(403).json({ 
      success: false, 
      message: 'Premium subscription has expired',
      upgradeUrl: '/api/subscription/plans'
    });
  }
  
  next();
};

// Log admin actions for audit trail
const logAdminAction = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Log the action after response is sent
      console.log(`[ADMIN ACTION] ${new Date().toISOString()} | User: ${req.user?.email} | Action: ${action} | IP: ${req.ip} | Status: ${res.statusCode}`);
      
      // You could also save to database here for a proper audit log
      // AuditLog.create({ userId: req.user.id, action, details: req.body, ip: req.ip });
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

module.exports = {
  requireAdmin,
  requireAdminSession,
  requirePremium,
  logAdminAction
};
