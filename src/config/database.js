// ===========================================
// Database Configuration - PostgreSQL with Sequelize
// ===========================================

const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// CASE 1: PRODUCTION (RAILWAY)
// If a DATABASE_URL exists, we use it. We also enable SSL which Railway requires.
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  });
} 
// CASE 2: LOCAL DEV (YOUR COMPUTER)
// If no DATABASE_URL, we use your local .env variables
else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'claritynest',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: console.log,
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      }
    }
  );
}

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    process.exit(1);
  }
};

// Sync models with database
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};