// ===========================================
// Stripe Routes - /api/subscription
// ===========================================

const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const { authenticateJWT } = require('../middleware/auth');

// Public route - get available plans
router.get('/plans', stripeController.getPlans);

// Protected routes - require authentication
router.post('/checkout', authenticateJWT, stripeController.createCheckoutSession);
router.post('/portal', authenticateJWT, stripeController.createPortalSession);
router.get('/status', authenticateJWT, stripeController.getSubscription);
router.post('/cancel', authenticateJWT, stripeController.cancelSubscription);
router.post('/reactivate', authenticateJWT, stripeController.reactivateSubscription);

// Webhook route - uses raw body, no auth (verified by Stripe signature)
// Note: This is handled separately in app.js with express.raw()

module.exports = router;
