// ===========================================
// Mood Model - Emotional check-ins
// ===========================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Mood = sequelize.define('Mood', {
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
    value: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: false
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    netWorthSnapshot: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'net_worth_snapshot',
      get() {
        const value = this.getDataValue('netWorthSnapshot');
        return value === null ? null : parseFloat(value);
      }
    },
    checkinDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'checkin_date'
    },
    // Additional analytics fields
    weatherCondition: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'weather_condition'
    },
    sleepHours: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
      field: 'sleep_hours'
    },
    exercised: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    tableName: 'moods',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['checkin_date'] },
      { fields: ['value'] },
      { fields: ['user_id', 'checkin_date'] }
    ]
  });

  // Class method to get mood analytics
  Mood.getAnalytics = async function(userId, startDate, endDate) {
    const { Op, fn, col } = require('sequelize');
    
    const where = { userId };
    if (startDate || endDate) {
      where.checkinDate = {};
      if (startDate) where.checkinDate[Op.gte] = startDate;
      if (endDate) where.checkinDate[Op.lte] = endDate;
    }

    const [average, count, tagCounts] = await Promise.all([
      this.findOne({
        where,
        attributes: [[fn('AVG', col('value')), 'avgMood']],
        raw: true
      }),
      this.count({ where }),
      this.findAll({
        where,
        attributes: ['tags'],
        raw: true
      })
    ]);

    // Count tag frequencies
    const tagFrequency = {};
    tagCounts.forEach(m => {
      (m.tags || []).forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    });

    return {
      averageMood: average?.avgMood ? parseFloat(average.avgMood).toFixed(1) : null,
      totalCheckins: count,
      tagFrequency: Object.entries(tagFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  };

  return Mood;
};
