// ===========================================
// Transaction Model - Financial transactions per account
// ===========================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'account_id',
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal', 'interest', 'expense', 'transfer', 'adjustment'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const value = this.getDataValue('amount');
        return value === null ? 0 : parseFloat(value);
      }
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    transactionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'transaction_date'
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'balance_after',
      get() {
        const value = this.getDataValue('balanceAfter');
        return value === null ? null : parseFloat(value);
      }
    }
  }, {
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      { fields: ['account_id'] },
      { fields: ['user_id'] },
      { fields: ['transaction_date'] },
      { fields: ['type'] },
      { fields: ['user_id', 'transaction_date'] }
    ]
  });

  // Hook to update account balance after transaction
  Transaction.afterCreate(async (transaction) => {
    const Account = sequelize.models.Account;
    const account = await Account.findByPk(transaction.accountId);
    if (account) {
      account.balance = parseFloat(account.balance) + parseFloat(transaction.amount);
      await account.save();
      
      // Update balance_after on transaction
      transaction.balanceAfter = account.balance;
      await transaction.save({ hooks: false });
    }
  });

  Transaction.afterDestroy(async (transaction) => {
    const Account = sequelize.models.Account;
    const account = await Account.findByPk(transaction.accountId);
    if (account) {
      account.balance = parseFloat(account.balance) - parseFloat(transaction.amount);
      await account.save();
    }
  });

  return Transaction;
};
