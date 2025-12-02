// ===========================================
// Budget Routes - /api/budgets
// ===========================================

const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { authenticateJWT } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateJWT);

// Get default categories (for creating new budgets)
router.get('/categories', budgetController.getCategories);

// Get all budgets with summary
router.get('/', budgetController.getBudgets);

// Recalculate all budgets from transactions
router.post('/recalculate', budgetController.recalculateBudgets);

// Roll over budgets to new period
router.post('/rollover', budgetController.rolloverBudgets);

// Add expense to a category
router.post('/expense', budgetController.addExpense);

// Get single budget with transactions
router.get('/:id', budgetController.getBudget);

// Create new budget
router.post('/', budgetController.createBudget);

// Update budget
router.patch('/:id', budgetController.updateBudget);

// Delete budget
router.delete('/:id', budgetController.deleteBudget);

module.exports = router;
