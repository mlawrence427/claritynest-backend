// ===========================================
// Stripe Configuration
// ===========================================

const Stripe = require('stripe');
require('dotenv').config();

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Product/Price IDs (you'll create these in Stripe Dashboard)
const PRODUCTS = {
  premium_monthly: {
    priceId: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
    name: 'ClarityNest Premium Monthly',
    amount: 999, // $9.99
    interval: 'month'
  },
  premium_yearly: {
    priceId: process.env.STRIPE_PRICE_YEARLY || 'price_yearly_placeholder',
    name: 'ClarityNest Premium Yearly',
    amount: 7999, // $79.99 (save ~33%)
    interval: 'year'
  }
};

module.exports = {
  stripe,
  PRODUCTS
};
