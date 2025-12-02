// ===========================================
// Admin Controller - Dashboard and user management
// ===========================================

const { User, Account, Transaction, Mood, Post, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

// Get dashboard overview stats
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // User stats
    const [totalUsers, activeUsers, premiumUsers, newUsersThisWeek] = await Promise.all([
      User.count(),
      User.count({ where: { isActive: true } }),
      User.count({ where: { isPremium: true } }),
      User.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } })
    ]);

    // Financial stats
    const accountStats = await Account.findOne({
      attributes: [
        [fn('SUM', col('balance')), 'totalAssets'],
        [fn('COUNT', col('id')), 'totalAccounts']
      ],
      raw: true
    });

    // Mood stats
    const moodStats = await Mood.findOne({
      attributes: [
        [fn('AVG', col('value')), 'avgMood'],
        [fn('COUNT', col('id')), 'totalCheckins']
      ],
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      raw: true
    });

    // Transaction volume (last 30 days)
    const txVolume = await Transaction.findOne({
      attributes: [
        [fn('SUM', fn('ABS', col('amount'))), 'volume'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      raw: true
    });

    // Community stats
    const postStats = await Post.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'totalPosts'],
        [fn('SUM', col('likes')), 'totalLikes']
      ],
      where: { isApproved: true },
      raw: true
    });

    // User growth chart data (last 30 days)
    const userGrowth = await User.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'date'],
        [fn('COUNT', col('id')), 'count']
      ],
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          premium: premiumUsers,
          newThisWeek: newUsersThisWeek,
          conversionRate: totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(1) : 0
        },
        financial: {
          totalAssets: parseFloat(accountStats?.totalAssets || 0),
          totalAccounts: parseInt(accountStats?.totalAccounts || 0),
          txVolume30d: parseFloat(txVolume?.volume || 0),
          txCount30d: parseInt(txVolume?.count || 0)
        },
        engagement: {
          avgMood: moodStats?.avgMood ? parseFloat(moodStats.avgMood).toFixed(1) : null,
          moodCheckins30d: parseInt(moodStats?.totalCheckins || 0),
          totalPosts: parseInt(postStats?.totalPosts || 0),
          totalLikes: parseInt(postStats?.totalLikes || 0)
        },
        userGrowth
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard stats' 
    });
  }
};

// Get all users (paginated)
const getUsers = async (req, res) => {
  try {
    const { search, role, status, limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    const where = {};
    
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (role) where.role = role;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get account count and net worth for each user
    const userIds = users.map(u => u.id);
    const accountStats = await Account.findAll({
      attributes: [
        'userId',
        [fn('COUNT', col('id')), 'accountCount'],
        [fn('SUM', col('balance')), 'netWorth']
      ],
      where: { userId: { [Op.in]: userIds } },
      group: ['userId'],
      raw: true
    });

    const statsMap = {};
    accountStats.forEach(s => {
      statsMap[s.userId] = {
        accountCount: parseInt(s.accountCount),
        netWorth: parseFloat(s.netWorth || 0)
      };
    });

    const enrichedUsers = users.map(user => ({
      ...user.toJSON(),
      stats: statsMap[user.id] || { accountCount: 0, netWorth: 0 }
    }));

    res.json({
      success: true,
      users: enrichedUsers,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users' 
    });
  }
};

// Get single user details
const getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      include: [
        { model: Account, as: 'accounts' },
        { model: Mood, as: 'moods', limit: 10, order: [['checkinDate', 'DESC']] },
        { model: Post, as: 'posts', limit: 10, order: [['createdAt', 'DESC']] }
      ]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Calculate stats
    const netWorth = user.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const avgMood = user.moods.length > 0
      ? (user.moods.reduce((sum, m) => sum + m.value, 0) / user.moods.length).toFixed(1)
      : null;

    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        stats: {
          netWorth,
          avgMood,
          accountCount: user.accounts.length,
          moodCount: user.moods.length,
          postCount: user.posts.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user' 
    });
  }
};

// Update user (admin)
const updateUser = async (req, res) => {
  try {
    const { role, isActive, isPremium, premiumExpiresAt } = req.body;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Prevent demoting self
    if (user.id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot change your own admin role' 
      });
    }

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (isPremium !== undefined) user.isPremium = isPremium;
    if (premiumExpiresAt !== undefined) user.premiumExpiresAt = premiumExpiresAt;

    await user.save({ hooks: false });

    res.json({
      success: true,
      message: 'User updated',
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update user' 
    });
  }
};

// Delete user (admin)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account from admin panel' 
      });
    }

    await user.destroy();

    res.json({ 
      success: true, 
      message: 'User deleted' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user' 
    });
  }
};

// Get flagged posts
const getFlaggedPosts = async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { isFlagged: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'name']
      }],
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch flagged posts' 
    });
  }
};

// Moderate post (approve/reject)
const moderatePost = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    if (action === 'approve') {
      post.isFlagged = false;
      post.flagReason = null;
      post.isApproved = true;
    } else if (action === 'reject') {
      await post.destroy();
      return res.json({ 
        success: true, 
        message: 'Post rejected and deleted' 
      });
    }

    await post.save();

    res.json({
      success: true,
      message: 'Post moderated',
      post
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to moderate post' 
    });
  }
};

// Export user data (for data portability/GDPR)
const exportUserData = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      include: [
        { model: Account, as: 'accounts', include: [{ model: Transaction, as: 'transactions' }] },
        { model: Mood, as: 'moods' },
        { model: Post, as: 'posts' }
      ]
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      exportDate: new Date().toISOString(),
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export user data' 
    });
  }
};

// System health check
const getSystemHealth = async (req, res) => {
  try {
    // Test database connection
    await sequelize.authenticate();

    res.json({
      success: true,
      status: 'healthy',
      checks: {
        database: 'operational',
        server: 'operational'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      checks: {
        database: 'error',
        server: 'operational'
      },
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getFlaggedPosts,
  moderatePost,
  exportUserData,
  getSystemHealth
};
