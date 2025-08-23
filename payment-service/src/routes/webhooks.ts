// routes/webhooks.ts
import express from 'express';
import { stripe } from '../index';
import { Subscription } from '../models/Subscription';
import { Payment } from '../models/Payment';
import { publishEvent } from '../services/eventService';
import Stripe from 'stripe';
import { getSubscriptionIdFromInvoice, getPaymentIntentFromInvoice } from '../types/stripe-extended';

const router = express.Router();

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as any);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as any);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription) {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id
  });

  if (subscription) {
    // Assume single item; adjust if multi-item
    const item = stripeSubscription.items.data[0];
    subscription.status = stripeSubscription.status as any;
    subscription.currentPeriodStart = new Date(item.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(item.current_period_end * 1000);
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
    
    await subscription.save();

    await publishEvent('subscription.updated' as any, {
      userId: subscription.userId,
      subscriptionId: subscription._id,
      status: subscription.status
    });
  }
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id
  });

  if (subscription) {
    subscription.status = 'canceled';
    await subscription.save();

    await publishEvent('subscription.deleted' as any, {
      userId: subscription.userId,
      subscriptionId: subscription._id
    });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const subscription = await Subscription.findOne({ stripeSubscriptionId: subscriptionId });
  if (!subscription) return;

  let chargeId: string | undefined;
  let paymentIntentId: string | undefined;

  // Use the helper only (don’t read invoice.payment_intent directly)
  paymentIntentId = getPaymentIntentFromInvoice(invoice);

  // If we have a PI, fetch it to get latest_charge
  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.latest_charge) {
      chargeId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;
    }
  }

  const payment = new Payment({
    userId: subscription.userId,
    subscriptionId: subscription._id,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    description: `Payment for ${subscription.planType} plan`,
  });

  await payment.save();

  await publishEvent('payment.succeeded' as any, {
    userId: subscription.userId,
    paymentId: payment._id,
    amount: payment.amount,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  
  if (subscriptionId) {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });

    if (subscription) {
      await publishEvent('payment.failed' as any, {
        userId: subscription.userId,
        subscriptionId: subscription._id,
        amount: invoice.amount_due
      });
    }
  }
}

export default router;