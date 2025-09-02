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
    currency: 'usd',
    interval: 'month',
    features: ['Access to basic courses', 'Standard support']
  },
  premium: {
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
    name: 'Premium Plan',
    price: 0.02,
    currency: 'usd',
    interval: 'month',
    features: ['Access to all courses', 'Priority support', 'Certificates']
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    name: 'Enterprise Plan',
    price: 0.03,
    currency: 'usd',
    interval: 'month',
    features: ['Everything in Premium', 'Team management', 'Analytics']
  }
};

// Get available plans - FIXED: Return array format
router.get('/plans', (req, res) => {
  // Convert plans object to array format expected by frontend
  const plansArray = Object.entries(PLANS).map(([planType, planData]) => ({
    id: planType,
    planType: planType,
    name: planData.name,
    price: planData.price,
    currency: planData.currency,
    interval: planData.interval,
    features: planData.features
  }));
 
  res.json(plansArray);
});

// Get user's subscription - FIXED: Return proper structure
router.get('/current', verifyToken, async (req: AuthRequest, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.userId }).lean();
   
    if (!subscription) {
      return res.json(null); // Return null directly, not wrapped
    }

    // Return the subscription object directly
    res.json(subscription);
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create subscription - IMPROVED ERROR HANDLING
router.post('/create', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { planType, paymentMethodId } = req.body;
   
    console.log('Creating subscription request:', { planType, userId: req.userId, userEmail: req.userEmail });
   
    if (!PLANS[planType as keyof typeof PLANS]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      userId: req.userId,
      status: { $in: ['active', 'past_due', 'incomplete', 'trialing'] }
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
        console.log('Found existing customer:', customer.id);
      } else {
        customer = await stripe.customers.create({
          email: req.userEmail!,
          metadata: { userId: req.userId! }
        });
        console.log('Created new customer:', customer.id);
      }
    } catch (error: any) {
      console.error('Customer creation error:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Attach payment method to customer (if provided)
    if (paymentMethodId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id
        });

        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
        console.log('Payment method attached:', paymentMethodId);
      } catch (error: any) {
        console.error('Payment method attach error:', error);
        return res.status(400).json({ error: 'Failed to attach payment method' });
      }
    }

    // Create subscription
    let stripeSubscription: Stripe.Subscription;
    try {
      stripeSubscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: PLANS[planType as keyof typeof PLANS].priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'], // Expand payment intent directly
        trial_period_days: 7, // 7-day free trial
        metadata: { userId: req.userId! }
      });
      console.log('Stripe subscription created:', stripeSubscription.id, 'Status:', stripeSubscription.status);
    } catch (error: any) {
      console.error('Stripe subscription creation error:', error);
      return res.status(500).json({ error: 'Failed to create subscription in Stripe' });
    }

    // Save subscription to database with proper status handling
    try {
      const subscription = new Subscription({
        userId: req.userId,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: stripeSubscription.id,
        planType,
        status: stripeSubscription.status, // This should now handle 'trialing'
        currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined
      });

      await subscription.save();
      console.log('Subscription saved to database:', subscription._id);

      // Publish subscription created event
      await publishEvent('subscription.created' as any, {
        userId: req.userId,
        subscriptionId: subscription._id,
        planType,
        status: subscription.status
      });

    } catch (error: any) {
      console.error('Database save error:', error);
      // Try to cancel the Stripe subscription if DB save fails
      try {
        await stripe.subscriptions.cancel(stripeSubscription.id);
      } catch (cancelError) {
        console.error('Failed to cancel Stripe subscription after DB error:', cancelError);
      }
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    // Handle latest_invoice and extract client_secret
    let clientSecret: string | null = null;
   
    try {
      if (stripeSubscription.latest_invoice) {
        const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
        const paymentIntentId = getPaymentIntentFromInvoice(invoice);
       
        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          clientSecret = paymentIntent.client_secret;
          console.log('Client secret extracted for payment intent:', paymentIntentId);
        }
      }
    } catch (error: any) {
      console.error('Error extracting client secret:', error);
      // Don't fail the entire request for this
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
      status: { $in: ['active', 'past_due', 'trialing'] }
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
      status: { $in: ['active', 'trialing'] }
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