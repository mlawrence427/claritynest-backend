// ===========================================
// Authentication Configuration - JWT & Passport
// ===========================================

const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT Options
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key'
};

// Initialize passport strategies
const initializePassport = (User) => {
  
  // JWT Strategy - for API authentication
  passport.use('jwt', new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findByPk(payload.id, {
        attributes: { exclude: ['password'] }
      });
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }
      
      if (!user.isActive) {
        return done(null, false, { message: 'Account is deactivated' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }));

  // Local Strategy - for session-based admin login
  passport.use('local', new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email: email.toLowerCase() } });
        
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        if (!user.isActive) {
          return done(null, false, { message: 'Account is deactivated' });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

// Generate JWT tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  
  return { accessToken, refreshToken };
};

// Verify JWT token
const verifyToken = (token, isRefresh = false) => {
  const secret = isRefresh 
    ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
    : process.env.JWT_SECRET;
    
  return jwt.verify(token, secret);
};

module.exports = {
  passport,
  initializePassport,
  generateTokens,
  verifyToken,
  jwtOptions
};
