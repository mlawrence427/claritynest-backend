// ===========================================
// Community Controller - Posts and interactions
// ===========================================

const { Post, PostLike, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get community posts (feed)
const getPosts = async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    const where = { isApproved: true, isFlagged: false };
    if (category) where.category = category;

    const { count, rows: posts } = await Post.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name'] // Only include if not anonymous
      }]
    });

    // Check if current user has liked each post
    let userLikes = [];
    if (req.user) {
      userLikes = await PostLike.findAll({
        where: {
          userId: req.user.id,
          postId: { [Op.in]: posts.map(p => p.id) }
        },
        attributes: ['postId']
      });
    }
    const likedPostIds = new Set(userLikes.map(l => l.postId));

    // Format posts (hide user info for anonymous posts)
    const formattedPosts = posts.map(post => ({
      id: post.id,
      content: post.content,
      likes: post.likes,
      category: post.category,
      createdAt: post.createdAt,
      isOwn: req.user ? post.userId === req.user.id : false,
      hasLiked: likedPostIds.has(post.id),
      author: post.isAnonymous ? null : { name: post.user?.name }
    }));

    res.json({
      success: true,
      posts: formattedPosts,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch posts' 
    });
  }
};

// Create new post
const createPost = async (req, res) => {
  try {
    const { content, isAnonymous = true, category = 'win' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post content is required' 
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post content must be under 1000 characters' 
      });
    }

    const post = await Post.create({
      userId: req.user.id,
      content: content.trim(),
      isAnonymous,
      category,
      isApproved: true // Auto-approve for MVP
    });

    res.status(201).json({
      success: true,
      message: 'Post created',
      post: {
        id: post.id,
        content: post.content,
        likes: 0,
        category: post.category,
        createdAt: post.createdAt,
        isOwn: true,
        hasLiked: false
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create post' 
    });
  }
};

// Like/unlike a post
const toggleLike = async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    // Check if already liked
    const existingLike = await PostLike.findOne({
      where: { postId, userId: req.user.id }
    });

    if (existingLike) {
      // Unlike
      await existingLike.destroy();
      post.likes = Math.max(0, post.likes - 1);
      await post.save();

      return res.json({
        success: true,
        message: 'Post unliked',
        likes: post.likes,
        hasLiked: false
      });
    } else {
      // Like
      await PostLike.create({ postId, userId: req.user.id });
      post.likes += 1;
      await post.save();

      return res.json({
        success: true,
        message: 'Post liked',
        likes: post.likes,
        hasLiked: true
      });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update like' 
    });
  }
};

// Delete own post
const deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found or not owned by you' 
      });
    }

    await post.destroy();

    res.json({ 
      success: true, 
      message: 'Post deleted' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete post' 
    });
  }
};

// Flag post for review
const flagPost = async (req, res) => {
  try {
    const { reason } = req.body;

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      });
    }

    post.isFlagged = true;
    post.flagReason = reason || 'Flagged by user';
    await post.save();

    res.json({ 
      success: true, 
      message: 'Post flagged for review' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to flag post' 
    });
  }
};

// Get community insights/stats
const getInsights = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count posts today
    const postsToday = await Post.count({
      where: {
        createdAt: { [Op.gte]: today },
        isApproved: true
      }
    });

    // Get most popular category
    const categoryStats = await Post.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { isApproved: true },
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 1,
      raw: true
    });

    // Get total likes today
    const likesToday = await PostLike.count({
      where: {
        createdAt: { [Op.gte]: today }
      }
    });

    res.json({
      success: true,
      insights: {
        postsToday,
        topCategory: categoryStats[0]?.category || 'win',
        likesToday,
        // Simulated stats for demo
        activeUsers: Math.floor(Math.random() * 50) + 20,
        topMood: 'Calm'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch insights' 
    });
  }
};

module.exports = {
  getPosts,
  createPost,
  toggleLike,
  deletePost,
  flagPost,
  getInsights
};
