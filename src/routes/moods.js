// ===========================================
// Mood Routes - /api/moods
// ===========================================

const express = require('express');
const router = express.Router();
const moodController = require('../controllers/moodController');
const { authenticateJWT } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateJWT);

// Mood CRUD
router.get('/', moodController.getMoods);
router.get('/analytics', moodController.getAnalytics);
router.get('/tags', moodController.getTags);
router.get('/:id', moodController.getMood);
router.post('/', moodController.createMood);
router.patch('/:id', moodController.updateMood);
router.delete('/:id', moodController.deleteMood);

module.exports = router;
