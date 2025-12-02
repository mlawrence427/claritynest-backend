// ===========================================
// Stripe Controller - Payments & Subscriptions
// ===========================================

const { stripe, PRODUCTS } = require('../config/stripe');
const { User } = require('../models');

// Get available subscription plans
const getPlans = async (req, res) => {
  try {
    const plans = Object.entries(PRODUCTS).map(([key, product]) => ({
      id: key,
      name: product.name,
      priceId: product.priceId,
      amount: product.amount,
      currency: 'usd',
      interval: product.interval,
      displayPrice: `$${(product.amount / 100).toFixed(2)}/${product.interval}`
    }));

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans'
    });
  }
};

// Create Stripe Checkout Session
const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    // Validate plan
    const product = PRODUCTS[planId];
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;

      // Save customer ID to user
      await User.update(
        { stripeCustomerId: customerId },
        { where: { id: user.id } }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: product.priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/settings?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings?canceled=true`,
      metadata: {
        userId: user.id,
        planId: planId
      },
      subscription_data: {
        metadata: {
          userId: user.id
        }
      },
      allow_promotion_codes: true
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create Customer Portal Session (manage subscription)
const createPortalSession = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`
    });

    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
    });
  }
};

// Get user's subscription status
const getSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      return res.json({
        success: true,
        subscription: null,
        isPremium: user.isPremium
      });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: subscription.items.data[0]?.price?.nickname || 'Premium'
      },
      isPremium: user.isPremium
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription'
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription'
      });
    }

    // Cancel at period end (user keeps access until end of billing cycle)
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    res.json({
      success: true,
      message: 'Subscription will cancel at end of billing period',
      cancelAt: new Date(subscription.current_period_end * 1000)
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

// Reactivate canceled subscription
const reactivateSubscription = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription to reactivate'
      });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    res.json({
      success: true,
      message: 'Subscription reactivated',
      subscription: {
        id: subscription.id,
        status: subscription.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate subscription'
    });
  }
};

// Stripe Webhook Handler
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Still return 200 to acknowledge receipt
  }

  res.json({ received: true });
};

// ===========================================
// Webhook Helper Functions
// ===========================================

async function handleCheckoutComplete(session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const user = await User.findByPk(userId);
  if (!user) return;

  // Update user with subscription info
  user.isPremium = true;
  user.stripeSubscriptionId = session.subscription;
  user.premiumExpiresAt = null; // Will be set by subscription update
  await user.save({ hooks: false });

  console.log(`✅ User ${user.email} upgraded to premium`);
}

async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find user by customer ID
    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer.metadata?.userId) return;
  }

  const user = await User.findOne({
    where: { stripeSubscriptionId: subscription.id }
  }) || await User.findOne({
    where: { stripeCustomerId: subscription.customer }
  });

  if (!user) return;

  const isActive = ['active', 'trialing'].includes(subscription.status);
  
  user.isPremium = isActive;
  user.stripeSubscriptionId = subscription.id;
  user.premiumExpiresAt = new Date(subscription.current_period_end * 1000);
  user.role = isActive ? 'premium' : 'user';
  await user.save({ hooks: false });

  console.log(`📝 Subscription updated for ${user.email}: ${subscription.status}`);
}

async function handleSubscriptionCanceled(subscription) {
  const user = await User.findOne({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!user) return;

  user.isPremium = false;
  user.role = 'user';
  user.stripeSubscriptionId = null;
  await user.save({ hooks: false });

  console.log(`❌ Subscription canceled for ${user.email}`);
}

async function handlePaymentSucceeded(invoice) {
  if (invoice.subscription) {
    const user = await User.findOne({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (user) {
      console.log(`💰 Payment succeeded for ${user.email}: $${invoice.amount_paid / 100}`);
    }
  }
}

async function handlePaymentFailed(invoice) {
  if (invoice.subscription) {
    const user = await User.findOne({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (user) {
      console.log(`⚠️ Payment failed for ${user.email}`);
      // Could send an email notification here
    }
  }
}

module.exports = {
  getPlans,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  handleWebhook
};
