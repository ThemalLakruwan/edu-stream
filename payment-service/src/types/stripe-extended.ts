// types/stripe-extended.ts
// Create this file to extend Stripe types for the new API version

import Stripe from 'stripe';

// Extend the Invoice interface to include new properties from 2025-07-30.basil
export interface ExtendedStripeInvoice extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription;
  payment_intent?: string | Stripe.PaymentIntent;
}

// types/stripe-extended.ts
export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const extendedInvoice = invoice as ExtendedStripeInvoice;
  
  if (extendedInvoice.subscription) {
    return typeof extendedInvoice.subscription === 'string' 
      ? extendedInvoice.subscription 
      : extendedInvoice.subscription.id;
  }
  
  if (invoice.lines && invoice.lines.data.length > 0) {
    const line = invoice.lines.data[0];
    if (line.subscription) {
      return typeof line.subscription === 'string' 
        ? line.subscription 
        : line.subscription.id;
    }
  }
  
  return undefined; // instead of null
}

export function getPaymentIntentFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const extendedInvoice = invoice as ExtendedStripeInvoice;
  if (extendedInvoice.payment_intent) {
    return typeof extendedInvoice.payment_intent === 'string' 
      ? extendedInvoice.payment_intent 
      : extendedInvoice.payment_intent.id;
  }
  return undefined;
}
