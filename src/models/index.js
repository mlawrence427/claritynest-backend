// ===========================================
// Models Index - Initialize all models and associations
// ===========================================

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import model definitions
const UserModel = require('./User');
const AccountModel = require('./Account');
const TransactionModel = require('./Transaction');
const MoodModel = require('./Mood');
const PostModel = require('./Post');

// Initialize models
const User = UserModel(sequelize);
const Account = AccountModel(sequelize);
const Transaction = TransactionModel(sequelize);
const Mood = MoodModel(sequelize);
const Post = PostModel(sequelize);

// PostLike model (defined in Post.js)
const PostLike = sequelize.define('PostLike', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'post_id'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  }
}, {
  tableName: 'post_likes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['post_id', 'user_id'] }
  ]
});

// ===========================================
// Define Associations
// ===========================================

// User -> Accounts (One to Many)
User.hasMany(Account, { 
  foreignKey: 'userId', 
  as: 'accounts',
  onDelete: 'CASCADE' 
});
Account.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// User -> Transactions (One to Many)
User.hasMany(Transaction, { 
  foreignKey: 'userId', 
  as: 'transactions',
  onDelete: 'CASCADE' 
});
Transaction.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// Account -> Transactions (One to Many)
Account.hasMany(Transaction, { 
  foreignKey: 'accountId', 
  as: 'transactions',
  onDelete: 'CASCADE' 
});
Transaction.belongsTo(Account, { 
  foreignKey: 'accountId', 
  as: 'account' 
});

// User -> Moods (One to Many)
User.hasMany(Mood, { 
  foreignKey: 'userId', 
  as: 'moods',
  onDelete: 'CASCADE' 
});
Mood.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// User -> Posts (One to Many)
User.hasMany(Post, { 
  foreignKey: 'userId', 
  as: 'posts',
  onDelete: 'CASCADE' 
});
Post.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// Post -> PostLikes (One to Many)
Post.hasMany(PostLike, { 
  foreignKey: 'postId', 
  as: 'postLikes',
  onDelete: 'CASCADE' 
});
PostLike.belongsTo(Post, { 
  foreignKey: 'postId', 
  as: 'post' 
});

// User -> PostLikes (One to Many)
User.hasMany(PostLike, { 
  foreignKey: 'userId', 
  as: 'postLikes',
  onDelete: 'CASCADE' 
});
PostLike.belongsTo(User, { 
  foreignKey: 'userId', 
  as: 'user' 
});

// ===========================================
// Export all models
// ===========================================

module.exports = {
  sequelize,
  User,
  Account,
  Transaction,
  Mood,
  Post,
  PostLike
};
