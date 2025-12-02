// ===========================================
// Account Model - Financial accounts (checking, savings, investments, etc.)
// ===========================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Account = sequelize.define('Account', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    type: {
      type: DataTypes.ENUM('Cash', 'Savings', 'Investment', 'Retirement', 'Crypto', 'Debt'),
      allowNull: false
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      get() {
        const value = this.getDataValue('balance');
        return value === null ? 0 : parseFloat(value);
      }
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    institution: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_archived'
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#4A6C6F'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'display_order'
    }
  }, {
    tableName: 'accounts',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['type'] },
      { fields: ['user_id', 'is_archived'] }
    ]
  });

  // Calculate balance from transactions
  Account.prototype.recalculateBalance = async function() {
    const Transaction = sequelize.models.Transaction;
    const result = await Transaction.sum('amount', {
      where: { accountId: this.id }
    });
    this.balance = result || 0;
    await this.save();
    return this.balance;
  };

  return Account;
};
