// ===========================================
// Community Routes - /api/community
// ===========================================

const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');

// Public routes (with optional auth for like status)
router.get('/posts', optionalAuth, communityController.getPosts);
router.get('/insights', communityController.getInsights);

// Protected routes
router.post('/posts', authenticateJWT, communityController.createPost);
router.post('/posts/:id/like', authenticateJWT, communityController.toggleLike);
router.post('/posts/:id/flag', authenticateJWT, communityController.flagPost);
router.delete('/posts/:id', authenticateJWT, communityController.deletePost);

module.exports = router;
