// ===========================================
// Account Controller - CRUD for financial accounts
// ===========================================

const { Account, Transaction, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get all accounts for user
const getAccounts = async (req, res) => {
  try {
    const { includeArchived } = req.query;
    
    const where = { userId: req.user.id };
    if (!includeArchived) {
      where.isArchived = false;
    }

    const accounts = await Account.findAll({
      where,
      order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
      include: [{
        model: Transaction,
        as: 'transactions',
        limit: 5,
        order: [['transactionDate', 'DESC']]
      }]
    });

    // Calculate net worth
    const netWorth = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    res.json({
      success: true,
      accounts,
      netWorth,
      count: accounts.length
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch accounts' 
    });
  }
};

// Get single account with full transaction history
const getAccount = async (req, res) => {
  try {
    const account = await Account.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: Transaction,
        as: 'transactions',
        order: [['transactionDate', 'DESC']]
      }]
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    res.json({ 
      success: true, 
      account 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch account' 
    });
  }
};

// Create new account
const createAccount = async (req, res) => {
  try {
    const { name, type, balance, currency, institution, notes, color } = req.body;

    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and type are required' 
      });
    }

    // Validate type
    const validTypes = ['Cash', 'Savings', 'Investment', 'Retirement', 'Crypto', 'Debt'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid account type' 
      });
    }

    // For debt accounts, make balance negative
    let initialBalance = parseFloat(balance) || 0;
    if (type === 'Debt' && initialBalance > 0) {
      initialBalance = -initialBalance;
    }

    // Create account with transaction
    const result = await sequelize.transaction(async (t) => {
      const account = await Account.create({
        userId: req.user.id,
        name,
        type,
        balance: 0, // Will be updated by transaction hook
        currency: currency || 'USD',
        institution,
        notes,
        color
      }, { transaction: t });

      // Create opening balance transaction
      if (initialBalance !== 0) {
        await Transaction.create({
          accountId: account.id,
          userId: req.user.id,
          type: initialBalance > 0 ? 'deposit' : 'withdrawal',
          amount: initialBalance,
          note: 'Opening Balance',
          transactionDate: new Date()
        }, { transaction: t });
      }

      // Fetch updated account
      return Account.findByPk(account.id, { transaction: t });
    });

    res.status(201).json({ 
      success: true, 
      message: 'Account created',
      account: result 
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create account' 
    });
  }
};

// Update account
const updateAccount = async (req, res) => {
  try {
    const { name, institution, notes, color, isArchived, displayOrder } = req.body;
    
    const account = await Account.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    // Update allowed fields
    if (name) account.name = name;
    if (institution !== undefined) account.institution = institution;
    if (notes !== undefined) account.notes = notes;
    if (color) account.color = color;
    if (isArchived !== undefined) account.isArchived = isArchived;
    if (displayOrder !== undefined) account.displayOrder = displayOrder;

    await account.save();

    res.json({ 
      success: true, 
      message: 'Account updated',
      account 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update account' 
    });
  }
};

// Delete account (and all transactions)
const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    // Delete account (transactions cascade)
    await account.destroy();

    res.json({ 
      success: true, 
      message: 'Account deleted' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete account' 
    });
  }
};

// Add transaction to account
const addTransaction = async (req, res) => {
  try {
    const { type, amount, note, category, transactionDate } = req.body;

    if (!type || amount === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Type and amount are required' 
      });
    }

    const account = await Account.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Account not found' 
      });
    }

    // Calculate final amount based on transaction type
    const validTypes = ['deposit', 'withdrawal', 'interest', 'expense', 'transfer', 'adjustment'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid transaction type' 
      });
    }

    const isPositive = ['deposit', 'interest'].includes(type);
    const finalAmount = isPositive ? Math.abs(amount) : -Math.abs(amount);

    const transaction = await Transaction.create({
      accountId: account.id,
      userId: req.user.id,
      type,
      amount: finalAmount,
      note,
      category,
      transactionDate: transactionDate || new Date()
    });

    // Fetch updated account
    const updatedAccount = await Account.findByPk(account.id);

    res.status(201).json({ 
      success: true, 
      message: 'Transaction added',
      transaction,
      newBalance: updatedAccount.balance
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add transaction' 
    });
  }
};

// Get transactions for account
const getTransactions = async (req, res) => {
  try {
    const { startDate, endDate, type, limit = 50, offset = 0 } = req.query;

    const where = { accountId: req.params.id, userId: req.user.id };
    
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate[Op.gte] = new Date(startDate);
      if (endDate) where.transactionDate[Op.lte] = new Date(endDate);
    }
    
    if (type) where.type = type;

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where,
      order: [['transactionDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      transactions,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transactions' 
    });
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      where: { 
        id: req.params.txId, 
        accountId: req.params.id,
        userId: req.user.id 
      }
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    await transaction.destroy();

    // Get updated balance
    const account = await Account.findByPk(req.params.id);

    res.json({ 
      success: true, 
      message: 'Transaction deleted',
      newBalance: account.balance
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete transaction' 
    });
  }
};

// Get net worth history (for charts)
const getNetWorthHistory = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get all transactions for user in date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const transactions = await Transaction.findAll({
      where: {
        userId: req.user.id,
        transactionDate: { [Op.gte]: startDate }
      },
      order: [['transactionDate', 'ASC']],
      include: [{ model: Account, as: 'account', attributes: ['name', 'type'] }]
    });

    // Get current totals by account
    const accounts = await Account.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name', 'type', 'balance']
    });

    const currentNetWorth = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Build historical data points
    // For simplicity, return current data + transaction dates
    const history = transactions.map(tx => ({
      date: tx.transactionDate,
      amount: tx.amount,
      account: tx.account?.name,
      runningBalance: tx.balanceAfter
    }));

    res.json({
      success: true,
      currentNetWorth,
      accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
      history
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch net worth history' 
    });
  }
};

module.exports = {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  addTransaction,
  getTransactions,
  deleteTransaction,
  getNetWorthHistory
};
