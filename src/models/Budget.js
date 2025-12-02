// ===========================================
// Budget Model
// ===========================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Budget = sequelize.define('Budget', {
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
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    icon: {
      type: DataTypes.STRING(10),
      defaultValue: '📁'
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#4A6C6F'
    },
    budgetAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'budget_amount',
      validate: {
        min: 0
      }
    },
    spentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'spent_amount'
    },
    period: {
      type: DataTypes.ENUM('weekly', 'monthly', 'yearly'),
      defaultValue: 'monthly'
    },
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'period_start'
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'period_end'
    },
    alertThreshold: {
      type: DataTypes.INTEGER,
      defaultValue: 80, // Alert when 80% spent
      field: 'alert_threshold',
      validate: {
        min: 0,
        max: 100
      }
    },
    alertSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'alert_sent'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'budgets',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['category'] },
      { fields: ['period_start', 'period_end'] }
    ]
  });

  // Calculate percentage spent
  Budget.prototype.getPercentSpent = function() {
    if (this.budgetAmount <= 0) return 0;
    return Math.round((this.spentAmount / this.budgetAmount) * 100);
  };

  // Get status based on spending
  Budget.prototype.getStatus = function() {
    const percent = this.getPercentSpent();
    if (percent >= 100) return 'exceeded';
    if (percent >= this.alertThreshold) return 'warning';
    if (percent >= 50) return 'on-track';
    return 'good';
  };

  // Get remaining amount
  Budget.prototype.getRemainingAmount = function() {
    return Math.max(0, this.budgetAmount - this.spentAmount);
  };

  // Class method to get default categories
  Budget.getDefaultCategories = () => [
    { name: 'Food & Dining', icon: '🍔', color: '#FF6B6B' },
    { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
    { name: 'Entertainment', icon: '🎬', color: '#9B59B6' },
    { name: 'Shopping', icon: '🛍️', color: '#F39C12' },
    { name: 'Bills & Utilities', icon: '💡', color: '#3498DB' },
    { name: 'Healthcare', icon: '🏥', color: '#E74C3C' },
    { name: 'Education', icon: '📚', color: '#1ABC9C' },
    { name: 'Personal Care', icon: '💅', color: '#E91E63' },
    { name: 'Travel', icon: '✈️', color: '#00BCD4' },
    { name: 'Subscriptions', icon: '📱', color: '#673AB7' },
    { name: 'Groceries', icon: '🛒', color: '#8BC34A' },
    { name: 'Other', icon: '📁', color: '#607D8B' }
  ];

  return Budget;
};
