// ===========================================
// Post Model - Community posts and wins
// ===========================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Post = sequelize.define('Post', {
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
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 1000]
      }
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_anonymous'
    },
    isApproved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true, // Auto-approve for MVP
      field: 'is_approved'
    },
    isFlagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_flagged'
    },
    flagReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'flag_reason'
    },
    category: {
      type: DataTypes.ENUM('win', 'milestone', 'tip', 'question', 'general'),
      defaultValue: 'win'
    }
  }, {
    tableName: 'posts',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['is_approved'] },
      { fields: ['created_at'] },
      { fields: ['likes'] }
    ]
  });

  return Post;
};

// ===========================================
// PostLike Model - Track who liked what (prevents double-liking)
// ===========================================

module.exports.PostLikeModel = (sequelize) => {
  const PostLike = sequelize.define('PostLike', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'post_id',
      references: {
        model: 'posts',
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
    }
  }, {
    tableName: 'post_likes',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['post_id', 'user_id'] }
    ]
  });

  return PostLike;
};
