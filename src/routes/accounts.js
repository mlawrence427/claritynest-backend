// ===========================================
// Account Routes - /api/accounts
// ===========================================

const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { authenticateJWT } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateJWT);

// Account CRUD
router.get('/', accountController.getAccounts);
router.get('/net-worth-history', accountController.getNetWorthHistory);
router.get('/:id', accountController.getAccount);
router.post('/', accountController.createAccount);
router.patch('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

// Transaction routes (nested under accounts)
router.get('/:id/transactions', accountController.getTransactions);
router.post('/:id/transactions', accountController.addTransaction);
router.delete('/:id/transactions/:txId', accountController.deleteTransaction);

module.exports = router;
