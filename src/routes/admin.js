// ===========================================
// Admin API Routes - /api/admin
// ===========================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT } = require('../middleware/auth');
const { requireAdmin, logAdminAction } = require('../middleware/admin');

// All routes require authentication + admin role
router.use(authenticateJWT);
router.use(requireAdmin);

// Dashboard
router.get('/stats', adminController.getDashboardStats);
router.get('/health', adminController.getSystemHealth);

// User management
router.get('/users', logAdminAction('list_users'), adminController.getUsers);
router.get('/users/:id', logAdminAction('view_user'), adminController.getUser);
router.patch('/users/:id', logAdminAction('update_user'), adminController.updateUser);
router.delete('/users/:id', logAdminAction('delete_user'), adminController.deleteUser);
router.get('/users/:id/export', logAdminAction('export_user_data'), adminController.exportUserData);

// Content moderation
router.get('/posts/flagged', adminController.getFlaggedPosts);
router.post('/posts/:id/moderate', logAdminAction('moderate_post'), adminController.moderatePost);

module.exports = router;
