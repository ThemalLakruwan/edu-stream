// routes/subscriptions.ts
import express from 'express';
import { stripe } from '../index';
import { Subscription } from '../models/Subscription';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { publishEvent } from '../services/eventService';
import Stripe from 'stripe';
import { getPaymentIntentFromInvoice } from '../types/stripe-extended';

const router = express.Router();

// Subscription plans configuration
const PLANS = {
  basic: {
    priceId: process.env.STRIPE_BASIC_PRICE_ID!,
    name: 'Basic Plan',
    price: 0.01,
    features: ['Access to basic courses', 'Standard support']
  },
  premium: {
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
    name: 'Premium Plan',
    price: 0.02,
    features: ['Access to all courses', 'Priority support', 'Certificates']
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    name: 'Enterprise Plan',
    price: 0.03,
    features: ['Everything in Premium', 'Team management', 'Analytics']
  }
};

// Get available plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// Get user's subscription
router.get('/current', verifyToken, async (req: AuthRequest, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.userId }).lean();
    
    if (!subscription) {
      return res.json({ subscription: null });
    }

    res.json({ subscription });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create subscription
router.post('/create', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { planType, paymentMethodId } = req.body;
    
    if (!PLANS[planType as keyof typeof PLANS]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({ 
      userId: req.userId,
      status: { $in: ['active', 'past_due', 'incomplete'] }
    });

    if (existingSubscription) {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    // Create or get Stripe customer
    let customer: Stripe.Customer;
    try {
      const customers = await stripe.customers.list({
        email: req.userEmail,
        limit: 1
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: req.userEmail!,
          metadata: { userId: req.userId! }
        });
      }
    } catch (error: any) {
      console.error('Customer creation error:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Attach payment method to customer
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });

      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    // Create subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PLANS[planType as keyof typeof PLANS].priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'], // Expand payment intent directly
      trial_period_days: 7, // 7-day free trial
      metadata: { userId: req.userId! }
    });

    // Save subscription to database
    const subscription = new Subscription({
      userId: req.userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      planType,
      status: stripeSubscription.status as any,
      currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined
    });

    await subscription.save();

    // Publish subscription created event
    await publishEvent('subscription.created' as any, {
      userId: req.userId,
      subscriptionId: subscription._id,
      planType,
      status: subscription.status
    });

    // Handle latest_invoice and extract client_secret
    let clientSecret: string | null = null;
    
    if (stripeSubscription.latest_invoice) {
      const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const paymentIntentId = getPaymentIntentFromInvoice(invoice);
      
      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        clientSecret = paymentIntent.client_secret;
      }
    }

    res.json({
      subscriptionId: stripeSubscription.id,
      clientSecret,
      status: stripeSubscription.status
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
router.post('/cancel', verifyToken, async (req: AuthRequest, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      userId: req.userId,
      status: { $in: ['active', 'past_due'] }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel at period end to allow access until current period expires
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    // Publish subscription cancelled event
    await publishEvent('subscription.cancelled' as any, {
      userId: req.userId,
      subscriptionId: subscription._id,
      cancelDate: subscription.currentPeriodEnd
    });

    res.json({ message: 'Subscription will be cancelled at the end of current period' });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume subscription
router.post('/resume', verifyToken, async (req: AuthRequest, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      userId: req.userId,
      cancelAtPeriodEnd: true
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No cancelled subscription found' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    res.json({ message: 'Subscription resumed successfully' });
  } catch (error: any) {
    console.error('Resume subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change subscription plan
router.post('/change-plan', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { planType } = req.body;
    
    if (!PLANS[planType as keyof typeof PLANS]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const subscription = await Subscription.findOne({ 
      userId: req.userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: PLANS[planType as keyof typeof PLANS].priceId
      }],
      proration_behavior: 'create_prorations'
    });

    subscription.planType = planType as any;
    await subscription.save();

    res.json({ message: 'Plan changed successfully' });
  } catch (error: any) {
    console.error('Change plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;