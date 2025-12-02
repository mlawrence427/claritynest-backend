// ===========================================
// Export Routes - /api/export
// ===========================================

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticateJWT } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateJWT);

// Export routes
router.get('/json', exportController.exportJSON);
router.get('/csv', exportController.exportCSV);
router.get('/pdf', exportController.exportPDF);
router.get('/pdf/transactions/:accountId?', exportController.exportTransactionsPDF);

// Import route
router.post('/import', exportController.importJSON);

module.exports = router;
