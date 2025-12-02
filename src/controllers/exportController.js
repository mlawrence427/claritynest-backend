// ===========================================
// Export Controller - PDF, CSV, JSON exports
// ===========================================

const { User, Account, Transaction, Mood } = require('../models');
const { generateWealthReport, generateTransactionsPDF } = require('../utils/pdf');

// Export user data as JSON backup
const exportJSON = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] }
    });

    const accounts = await Account.findAll({
      where: { userId: req.user.id },
      include: [{ model: Transaction, as: 'transactions' }]
    });

    const moods = await Mood.findAll({
      where: { userId: req.user.id },
      order: [['checkinDate', 'DESC']]
    });

    const exportData = {
      exportVersion: '1.0',
      exportDate: new Date().toISOString(),
      user: user.toJSON(),
      accounts: accounts.map(a => a.toJSON()),
      moods: moods.map(m => m.toJSON())
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=claritynest_backup_${new Date().toISOString().slice(0,10)}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export data' 
    });
  }
};

// Export transactions as CSV
const exportCSV = async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;

    const accounts = await Account.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Transaction,
        as: 'transactions',
        order: [['transactionDate', 'DESC']]
      }]
    });

    const moods = await Mood.findAll({
      where: { userId: req.user.id },
      order: [['checkinDate', 'DESC']]
    });

    // Build CSV content
    let csv = 'Type,Account,Date,Transaction,Amount,Category,Balance After\n';
    
    accounts.forEach(acc => {
      if (accountId && acc.id !== accountId) return;
      
      acc.transactions.forEach(tx => {
        if (startDate && new Date(tx.transactionDate) < new Date(startDate)) return;
        if (endDate && new Date(tx.transactionDate) > new Date(endDate)) return;
        
        csv += `"${acc.type}","${acc.name}","${tx.transactionDate}","${tx.note || tx.type}",${tx.amount},"${tx.category || ''}",${tx.balanceAfter || ''}\n`;
      });
    });

    csv += '\n\nMood Check-ins\nDate,Mood,Tags,Note,Net Worth Snapshot\n';
    moods.forEach(m => {
      csv += `"${m.checkinDate}",${m.value},"${(m.tags || []).join('|')}","${(m.note || '').replace(/"/g, '""')}",${m.netWorthSnapshot || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=claritynest_export_${new Date().toISOString().slice(0,10)}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export CSV' 
    });
  }
};

// Generate and download PDF wealth report
const exportPDF = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] }
    });

    const accounts = await Account.findAll({
      where: { userId: req.user.id },
      order: [['displayOrder', 'ASC']]
    });

    const moods = await Mood.findAll({
      where: { userId: req.user.id },
      order: [['checkinDate', 'DESC']],
      limit: 30
    });

    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['transactionDate', 'DESC']],
      limit: 100
    });

    const pdfBuffer = await generateWealthReport({
      user: user.toJSON(),
      accounts: accounts.map(a => a.toJSON()),
      moods: moods.map(m => m.toJSON()),
      transactions: transactions.map(t => t.toJSON())
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ClarityNest_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate PDF report' 
    });
  }
};

// Export transactions PDF for specific account
const exportTransactionsPDF = async (req, res) => {
  try {
    const { accountId } = req.params;

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'name']
    });

    const accounts = await Account.findAll({
      where: { userId: req.user.id }
    });

    const where = { userId: req.user.id };
    if (accountId && accountId !== 'all') {
      where.accountId = accountId;
    }

    const transactions = await Transaction.findAll({
      where,
      order: [['transactionDate', 'DESC']],
      limit: 500
    });

    const pdfBuffer = await generateTransactionsPDF(
      {
        user: user.toJSON(),
        accounts: accounts.map(a => a.toJSON()),
        transactions: transactions.map(t => t.toJSON())
      },
      accountId !== 'all' ? accountId : null
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ClarityNest_Transactions_${new Date().toISOString().slice(0,10)}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Transactions PDF error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate transactions PDF' 
    });
  }
};

// Import data from backup
const importJSON = async (req, res) => {
  try {
    const importData = req.body;

    if (!importData || !importData.exportVersion) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid backup file format' 
      });
    }

    const imported = { accounts: 0, transactions: 0, moods: 0 };

    // Import accounts and transactions
    if (importData.accounts && Array.isArray(importData.accounts)) {
      for (const accData of importData.accounts) {
        // Create account
        const account = await Account.create({
          userId: req.user.id,
          name: accData.name,
          type: accData.type,
          balance: 0, // Will be calculated from transactions
          currency: accData.currency || 'USD',
          institution: accData.institution,
          notes: accData.notes,
          color: accData.color
        });
        imported.accounts++;

        // Import transactions
        if (accData.transactions && Array.isArray(accData.transactions)) {
          for (const txData of accData.transactions) {
            await Transaction.create({
              accountId: account.id,
              userId: req.user.id,
              type: txData.type,
              amount: txData.amount,
              note: txData.note,
              category: txData.category,
              transactionDate: txData.transactionDate || txData.transaction_date
            });
            imported.transactions++;
          }
        }
      }
    }

    // Import moods
    if (importData.moods && Array.isArray(importData.moods)) {
      for (const moodData of importData.moods) {
        await Mood.create({
          userId: req.user.id,
          value: moodData.value || moodData.val,
          tags: moodData.tags || [],
          note: moodData.note || '',
          checkinDate: moodData.checkinDate || moodData.checkin_date || moodData.date,
          netWorthSnapshot: moodData.netWorthSnapshot || moodData.net_worth_snapshot
        });
        imported.moods++;
      }
    }

    res.json({
      success: true,
      message: 'Data imported successfully',
      imported
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to import data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  exportJSON,
  exportCSV,
  exportPDF,
  exportTransactionsPDF,
  importJSON
};
