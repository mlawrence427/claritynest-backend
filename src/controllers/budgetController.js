// ===========================================
// Budget Controller
// ===========================================

const { Budget, Transaction } = require('../models');
const { Op } = require('sequelize');

// Get default budget categories
const getCategories = async (req, res) => {
  try {
    const categories = Budget.getDefaultCategories();
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

// Get all budgets for user
const getBudgets = async (req, res) => {
  try {
    const { period, includeInactive } = req.query;
    
    const where = { userId: req.user.id };
    
    if (!includeInactive) {
      where.isActive = true;
    }
    
    if (period) {
      where.period = period;
    }

    const budgets = await Budget.findAll({
      where,
      order: [['category', 'ASC']]
    });

    // Calculate stats
    const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.budgetAmount), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spentAmount), 0);
    const totalRemaining = totalBudgeted - totalSpent;

    // Add computed fields to each budget
    const budgetsWithStats = budgets.map(budget => ({
      ...budget.toJSON(),
      percentSpent: budget.getPercentSpent(),
      status: budget.getStatus(),
      remainingAmount: budget.getRemainingAmount()
    }));

    res.json({
      success: true,
      budgets: budgetsWithStats,
      summary: {
        totalBudgeted,
        totalSpent,
        totalRemaining,
        overallPercentSpent: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0,
        budgetCount: budgets.length,
        exceededCount: budgets.filter(b => b.getStatus() === 'exceeded').length,
        warningCount: budgets.filter(b => b.getStatus() === 'warning').length
      }
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets'
    });
  }
};

// Get single budget
const getBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    // Get related transactions for this category and period
    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.id,
        category: budget.category,
        transactionDate: {
          [Op.between]: [budget.periodStart, budget.periodEnd]
        },
        type: {
          [Op.in]: ['expense', 'withdrawal']
        }
      },
      order: [['transactionDate', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      budget: {
        ...budget.toJSON(),
        percentSpent: budget.getPercentSpent(),
        status: budget.getStatus(),
        remainingAmount: budget.getRemainingAmount()
      },
      transactions
    });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget'
    });
  }
};

// Create new budget
const createBudget = async (req, res) => {
  try {
    const {
      category,
      icon,
      color,
      budgetAmount,
      period = 'monthly',
      alertThreshold = 80,
      notes
    } = req.body;

    // Validate required fields
    if (!category || !budgetAmount) {
      return res.status(400).json({
        success: false,
        message: 'Category and budget amount are required'
      });
    }

    // Calculate period dates
    const now = new Date();
    let periodStart, periodEnd;

    if (period === 'weekly') {
      // Start of this week (Sunday)
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
    } else if (period === 'monthly') {
      // Start of this month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'yearly') {
      // Start of this year
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear(), 11, 31);
    }

    // Check if budget already exists for this category and period
    const existing = await Budget.findOne({
      where: {
        userId: req.user.id,
        category,
        periodStart,
        periodEnd
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Budget already exists for this category and period'
      });
    }

    // Calculate already spent amount for this category/period
    const spentResult = await Transaction.sum('amount', {
      where: {
        userId: req.user.id,
        category,
        transactionDate: {
          [Op.between]: [periodStart, periodEnd]
        },
        type: {
          [Op.in]: ['expense', 'withdrawal']
        }
      }
    });

    const spentAmount = Math.abs(spentResult || 0);

    // Create budget
    const budget = await Budget.create({
      userId: req.user.id,
      category,
      icon: icon || '📁',
      color: color || '#4A6C6F',
      budgetAmount,
      spentAmount,
      period,
      periodStart,
      periodEnd,
      alertThreshold,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      budget: {
        ...budget.toJSON(),
        percentSpent: budget.getPercentSpent(),
        status: budget.getStatus(),
        remainingAmount: budget.getRemainingAmount()
      }
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create budget'
    });
  }
};

// Update budget
const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    const {
      budgetAmount,
      icon,
      color,
      alertThreshold,
      isActive,
      notes
    } = req.body;

    // Update allowed fields
    if (budgetAmount !== undefined) budget.budgetAmount = budgetAmount;
    if (icon !== undefined) budget.icon = icon;
    if (color !== undefined) budget.color = color;
    if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;
    if (isActive !== undefined) budget.isActive = isActive;
    if (notes !== undefined) budget.notes = notes;

    // Reset alert if budget amount increased
    if (budgetAmount && budget.getPercentSpent() < budget.alertThreshold) {
      budget.alertSent = false;
    }

    await budget.save();

    res.json({
      success: true,
      message: 'Budget updated successfully',
      budget: {
        ...budget.toJSON(),
        percentSpent: budget.getPercentSpent(),
        status: budget.getStatus(),
        remainingAmount: budget.getRemainingAmount()
      }
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget'
    });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    await budget.destroy();

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete budget'
    });
  }
};

// Add expense to a budget category
const addExpense = async (req, res) => {
  try {
    const { category, amount, note } = req.body;

    if (!category || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Category and amount are required'
      });
    }

    // Find active budget for this category
    const now = new Date();
    const budget = await Budget.findOne({
      where: {
        userId: req.user.id,
        category,
        isActive: true,
        periodStart: { [Op.lte]: now },
        periodEnd: { [Op.gte]: now }
      }
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'No active budget found for this category'
      });
    }

    // Update spent amount
    budget.spentAmount = parseFloat(budget.spentAmount) + parseFloat(amount);
    
    // Check if alert should be sent
    const percentSpent = budget.getPercentSpent();
    let alertTriggered = false;
    
    if (percentSpent >= budget.alertThreshold && !budget.alertSent) {
      budget.alertSent = true;
      alertTriggered = true;
    }

    await budget.save();

    res.json({
      success: true,
      message: 'Expense added to budget',
      budget: {
        ...budget.toJSON(),
        percentSpent: budget.getPercentSpent(),
        status: budget.getStatus(),
        remainingAmount: budget.getRemainingAmount()
      },
      alert: alertTriggered ? {
        type: percentSpent >= 100 ? 'exceeded' : 'warning',
        message: percentSpent >= 100 
          ? `You've exceeded your ${category} budget!`
          : `You've used ${percentSpent}% of your ${category} budget`
      } : null
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add expense'
    });
  }
};

// Recalculate all budgets (sync with transactions)
const recalculateBudgets = async (req, res) => {
  try {
    const budgets = await Budget.findAll({
      where: {
        userId: req.user.id,
        isActive: true
      }
    });

    const updated = [];

    for (const budget of budgets) {
      // Calculate spent from transactions
      const spentResult = await Transaction.sum('amount', {
        where: {
          userId: req.user.id,
          category: budget.category,
          transactionDate: {
            [Op.between]: [budget.periodStart, budget.periodEnd]
          },
          type: {
            [Op.in]: ['expense', 'withdrawal']
          }
        }
      });

      const newSpentAmount = Math.abs(spentResult || 0);
      
      if (parseFloat(budget.spentAmount) !== newSpentAmount) {
        budget.spentAmount = newSpentAmount;
        
        // Reset alert if now under threshold
        if (budget.getPercentSpent() < budget.alertThreshold) {
          budget.alertSent = false;
        }
        
        await budget.save();
        updated.push(budget.category);
      }
    }

    res.json({
      success: true,
      message: `Recalculated ${updated.length} budgets`,
      updatedCategories: updated
    });
  } catch (error) {
    console.error('Recalculate budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate budgets'
    });
  }
};

// Roll over budgets to new period
const rolloverBudgets = async (req, res) => {
  try {
    const { period = 'monthly' } = req.body;
    
    // Get all active budgets for the specified period
    const oldBudgets = await Budget.findAll({
      where: {
        userId: req.user.id,
        period,
        isActive: true
      }
    });

    if (oldBudgets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No budgets found to roll over'
      });
    }

    // Calculate new period dates
    const now = new Date();
    let periodStart, periodEnd;

    if (period === 'weekly') {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
    } else if (period === 'monthly') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'yearly') {
      periodStart = new Date(now.getFullYear(), 0, 1);
      periodEnd = new Date(now.getFullYear(), 11, 31);
    }

    const newBudgets = [];

    for (const oldBudget of oldBudgets) {
      // Check if budget already exists for new period
      const exists = await Budget.findOne({
        where: {
          userId: req.user.id,
          category: oldBudget.category,
          periodStart,
          periodEnd
        }
      });

      if (!exists) {
        const newBudget = await Budget.create({
          userId: req.user.id,
          category: oldBudget.category,
          icon: oldBudget.icon,
          color: oldBudget.color,
          budgetAmount: oldBudget.budgetAmount,
          spentAmount: 0,
          period,
          periodStart,
          periodEnd,
          alertThreshold: oldBudget.alertThreshold,
          notes: oldBudget.notes
        });
        newBudgets.push(newBudget);
      }
    }

    res.json({
      success: true,
      message: `Created ${newBudgets.length} new budgets for the current ${period}`,
      budgets: newBudgets
    });
  } catch (error) {
    console.error('Rollover budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to roll over budgets'
    });
  }
};

module.exports = {
  getCategories,
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  addExpense,
  recalculateBudgets,
  rolloverBudgets
};
