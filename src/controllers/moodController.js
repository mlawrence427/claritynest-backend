// ===========================================
// Mood Controller - Emotional check-ins
// ===========================================

const { Mood, Account, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

// Get all moods for user
const getMoods = async (req, res) => {
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query;

    const where = { userId: req.user.id };
    
    if (startDate || endDate) {
      where.checkinDate = {};
      if (startDate) where.checkinDate[Op.gte] = new Date(startDate);
      if (endDate) where.checkinDate[Op.lte] = new Date(endDate);
    }

    const { count, rows: moods } = await Mood.findAndCountAll({
      where,
      order: [['checkinDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      moods,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get moods error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch moods' 
    });
  }
};

// Get single mood entry
const getMood = async (req, res) => {
  try {
    const mood = await Mood.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!mood) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mood entry not found' 
      });
    }

    res.json({ 
      success: true, 
      mood 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch mood' 
    });
  }
};

// Create new mood entry
const createMood = async (req, res) => {
  try {
    const { value, tags, note, weatherCondition, sleepHours, exercised } = req.body;

    if (!value || value < 1 || value > 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mood value must be between 1 and 10' 
      });
    }

    // Get current net worth for snapshot
    const accounts = await Account.findAll({
      where: { userId: req.user.id },
      attributes: ['balance']
    });
    const netWorthSnapshot = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    const mood = await Mood.create({
      userId: req.user.id,
      value: parseInt(value),
      tags: tags || [],
      note: note || '',
      netWorthSnapshot,
      checkinDate: new Date(),
      weatherCondition,
      sleepHours,
      exercised
    });

    res.status(201).json({ 
      success: true, 
      message: 'Mood logged successfully',
      mood 
    });
  } catch (error) {
    console.error('Create mood error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to log mood' 
    });
  }
};

// Update mood entry
const updateMood = async (req, res) => {
  try {
    const { value, tags, note, weatherCondition, sleepHours, exercised } = req.body;

    const mood = await Mood.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!mood) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mood entry not found' 
      });
    }

    // Update fields
    if (value !== undefined) {
      if (value < 1 || value > 10) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mood value must be between 1 and 10' 
        });
      }
      mood.value = parseInt(value);
    }
    if (tags !== undefined) mood.tags = tags;
    if (note !== undefined) mood.note = note;
    if (weatherCondition !== undefined) mood.weatherCondition = weatherCondition;
    if (sleepHours !== undefined) mood.sleepHours = sleepHours;
    if (exercised !== undefined) mood.exercised = exercised;

    await mood.save();

    res.json({ 
      success: true, 
      message: 'Mood updated',
      mood 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update mood' 
    });
  }
};

// Delete mood entry
const deleteMood = async (req, res) => {
  try {
    const mood = await Mood.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!mood) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mood entry not found' 
      });
    }

    await mood.destroy();

    res.json({ 
      success: true, 
      message: 'Mood entry deleted' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete mood' 
    });
  }
};

// Get mood analytics
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = { userId: req.user.id };
    if (startDate || endDate) {
      where.checkinDate = {};
      if (startDate) where.checkinDate[Op.gte] = new Date(startDate);
      if (endDate) where.checkinDate[Op.lte] = new Date(endDate);
    }

    // Get basic stats
    const stats = await Mood.findOne({
      where,
      attributes: [
        [fn('AVG', col('value')), 'avgMood'],
        [fn('MIN', col('value')), 'minMood'],
        [fn('MAX', col('value')), 'maxMood'],
        [fn('COUNT', col('id')), 'totalCheckins']
      ],
      raw: true
    });

    // Get mood distribution
    const distribution = await Mood.findAll({
      where,
      attributes: [
        'value',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['value'],
      order: [['value', 'ASC']],
      raw: true
    });

    // Get tag frequency
    const allMoods = await Mood.findAll({
      where,
      attributes: ['tags'],
      raw: true
    });

    const tagFrequency = {};
    allMoods.forEach(m => {
      (m.tags || []).forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    });

    // Get mood vs net worth correlation data
    const moodNetWorthData = await Mood.findAll({
      where,
      attributes: ['value', 'netWorthSnapshot', 'checkinDate'],
      order: [['checkinDate', 'ASC']],
      raw: true
    });

    // Get weekly trends
    const weeklyTrends = await Mood.findAll({
      where,
      attributes: [
        [fn('DATE_TRUNC', 'week', col('checkin_date')), 'week'],
        [fn('AVG', col('value')), 'avgMood'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [fn('DATE_TRUNC', 'week', col('checkin_date'))],
      order: [[fn('DATE_TRUNC', 'week', col('checkin_date')), 'DESC']],
      limit: 12,
      raw: true
    });

    res.json({
      success: true,
      analytics: {
        averageMood: stats.avgMood ? parseFloat(stats.avgMood).toFixed(1) : null,
        minMood: stats.minMood,
        maxMood: stats.maxMood,
        totalCheckins: parseInt(stats.totalCheckins) || 0,
        distribution: distribution.map(d => ({ value: d.value, count: parseInt(d.count) })),
        tagFrequency: Object.entries(tagFrequency)
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => ({ tag, count })),
        moodVsNetWorth: moodNetWorthData,
        weeklyTrends: weeklyTrends.reverse()
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics' 
    });
  }
};

// Get available mood tags
const getTags = async (req, res) => {
  const defaultTags = [
    'Anxious', 'Confident', 'Impulsive', 'Focused', 
    'Guilty', 'Excited', 'Avoidant', 'Calm', 
    'Stressed', 'Grateful', 'Overwhelmed', 'Motivated'
  ];

  res.json({
    success: true,
    tags: defaultTags
  });
};

module.exports = {
  getMoods,
  getMood,
  createMood,
  updateMood,
  deleteMood,
  getAnalytics,
  getTags
};
