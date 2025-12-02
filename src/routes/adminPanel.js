// ===========================================
// Admin Panel Routes - Server-rendered views
// ===========================================

const express = require('express');
const router = express.Router();
const { passport } = require('../config/auth');
const { requireAdminSession } = require('../middleware/admin');
const { User, Account, Transaction, Mood, Post, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

// ===========================================
// AUTH ROUTES
// ===========================================

// Login page
router.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user.role === 'admin') {
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Admin Login' });
});

// Login handler
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      req.flash('error', 'An error occurred');
      return res.redirect('/admin/login');
    }
    
    if (!user) {
      req.flash('error', info?.message || 'Invalid credentials');
      return res.redirect('/admin/login');
    }
    
    if (user.role !== 'admin') {
      req.flash('error', 'Admin access required');
      return res.redirect('/admin/login');
    }
    
    req.logIn(user, (err) => {
      if (err) {
        req.flash('error', 'Login failed');
        return res.redirect('/admin/login');
      }
      
      req.flash('success', 'Welcome back!');
      res.redirect('/admin');
    });
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error('Logout error:', err);
    req.flash('success', 'Logged out successfully');
    res.redirect('/admin/login');
  });
});

// ===========================================
// PROTECTED ADMIN ROUTES
// ===========================================

// Apply admin auth to all routes below
router.use(requireAdminSession);

// Dashboard
router.get('/', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [totalUsers, premiumUsers, totalAccounts, moodStats, recentUsers] = await Promise.all([
      User.count(),
      User.count({ where: { isPremium: true } }),
      Account.count(),
      Mood.findOne({
        attributes: [[fn('AVG', col('value')), 'avgMood']],
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
        raw: true
      }),
      User.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['id', 'email', 'name', 'role', 'createdAt']
      })
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers,
        premiumUsers,
        totalAccounts,
        avgMood: moodStats?.avgMood ? parseFloat(moodStats.avgMood).toFixed(1) : 'N/A'
      },
      recentUsers
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Failed to load dashboard');
    res.render('admin/dashboard', { title: 'Admin Dashboard', stats: {}, recentUsers: [] });
  }
});

// Users list
router.get('/users', async (req, res) => {
  try {
    const { search, role, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (role) where.role = role;

    const { count, rows: users } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] }
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/users', {
      title: 'User Management',
      users,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        count
      },
      filters: { search, role }
    });
  } catch (error) {
    console.error('Users list error:', error);
    req.flash('error', 'Failed to load users');
    res.redirect('/admin');
  }
});

// User detail
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      include: [
        { model: Account, as: 'accounts' },
        { model: Mood, as: 'moods', limit: 10, order: [['checkinDate', 'DESC']] }
      ]
    });

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    const netWorth = user.accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    res.render('admin/user-detail', {
      title: `User: ${user.email}`,
      user,
      netWorth
    });
  } catch (error) {
    console.error('User detail error:', error);
    req.flash('error', 'Failed to load user');
    res.redirect('/admin/users');
  }
});

// Update user
router.post('/users/:id', async (req, res) => {
  try {
    const { role, isActive, isPremium } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    if (user.id === req.user.id && role !== 'admin') {
      req.flash('error', 'Cannot change your own admin role');
      return res.redirect(`/admin/users/${user.id}`);
    }

    user.role = role || user.role;
    user.isActive = isActive === 'on';
    user.isPremium = isPremium === 'on';
    await user.save({ hooks: false });

    req.flash('success', 'User updated successfully');
    res.redirect(`/admin/users/${user.id}`);
  } catch (error) {
    console.error('Update user error:', error);
    req.flash('error', 'Failed to update user');
    res.redirect(`/admin/users/${req.params.id}`);
  }
});

// Delete user
router.post('/users/:id/delete', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/users');
    }

    if (user.id === req.user.id) {
      req.flash('error', 'Cannot delete your own account');
      return res.redirect('/admin/users');
    }

    await user.destroy();
    req.flash('success', 'User deleted');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Delete user error:', error);
    req.flash('error', 'Failed to delete user');
    res.redirect('/admin/users');
  }
});

// Posts moderation
router.get('/posts', async (req, res) => {
  try {
    const { filter = 'all' } = req.query;
    
    const where = {};
    if (filter === 'flagged') where.isFlagged = true;
    if (filter === 'pending') where.isApproved = false;

    const posts = await Post.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'name']
      }]
    });

    res.render('admin/posts', {
      title: 'Content Moderation',
      posts,
      filter
    });
  } catch (error) {
    console.error('Posts error:', error);
    req.flash('error', 'Failed to load posts');
    res.redirect('/admin');
  }
});

// Moderate post
router.post('/posts/:id/moderate', async (req, res) => {
  try {
    const { action } = req.body;
    const post = await Post.findByPk(req.params.id);

    if (!post) {
      req.flash('error', 'Post not found');
      return res.redirect('/admin/posts');
    }

    if (action === 'approve') {
      post.isFlagged = false;
      post.isApproved = true;
      await post.save();
      req.flash('success', 'Post approved');
    } else if (action === 'delete') {
      await post.destroy();
      req.flash('success', 'Post deleted');
    }

    res.redirect('/admin/posts');
  } catch (error) {
    console.error('Moderate post error:', error);
    req.flash('error', 'Failed to moderate post');
    res.redirect('/admin/posts');
  }
});

// System settings
router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    title: 'System Settings',
    env: {
      nodeEnv: process.env.NODE_ENV,
      dbHost: process.env.DB_HOST,
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

module.exports = router;
