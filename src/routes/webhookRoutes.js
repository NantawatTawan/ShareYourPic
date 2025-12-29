import express from 'express';
import { stripe } from '../config/stripe.js';
import { supabase } from '../config/database.js';
import { sendPaymentReceipt, sendExpiryWarning } from '../services/emailService.js';

const router = express.Router();

/**
 * Stripe Webhook Handler
 * Handle events from Stripe (payment success, subscription updates, etc.)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        case 'charge.refunded':
          await handleRefund(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionCanceled(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const metadata = paymentIntent.metadata;

  // Find subscription by payment intent ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, tenants(*)')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (!subscription) {
    console.log('No subscription found for payment intent:', paymentIntent.id);
    return;
  }

  // Update subscription status to active
  await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('id', subscription.id);

  // Record in billing history
  await supabase.from('billing_history').insert({
    tenant_id: subscription.tenant_id,
    subscription_id: subscription.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'paid',
    description: `Payment for ${metadata.plan_name || 'subscription'}`,
    paid_at: new Date().toISOString(),
  });

  console.log('Payment recorded for subscription:', subscription.id);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const metadata = paymentIntent.metadata;

  // Find subscription by payment intent ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, tenants(*)')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (!subscription) {
    console.log('No subscription found for payment intent:', paymentIntent.id);
    return;
  }

  // Update subscription status to payment_failed
  await supabase
    .from('subscriptions')
    .update({ status: 'payment_failed' })
    .eq('id', subscription.id);

  // Record in billing history
  await supabase.from('billing_history').insert({
    tenant_id: subscription.tenant_id,
    subscription_id: subscription.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'failed',
    description: `Failed payment for ${metadata.plan_name || 'subscription'}`,
  });

  console.log('Payment failure recorded for subscription:', subscription.id);

  // TODO: Send email notification to user about failed payment
}

/**
 * Handle refund
 */
async function handleRefund(charge) {
  console.log('Charge refunded:', charge.id);

  // Find payment intent
  const paymentIntentId = charge.payment_intent;

  // Find subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (!subscription) {
    console.log('No subscription found for refund:', paymentIntentId);
    return;
  }

  // Update subscription status to refunded
  await supabase
    .from('subscriptions')
    .update({
      status: 'refunded',
      current_period_end: new Date().toISOString(), // End immediately
    })
    .eq('id', subscription.id);

  // Record in billing history
  await supabase.from('billing_history').insert({
    tenant_id: subscription.tenant_id,
    subscription_id: subscription.id,
    amount: -charge.amount_refunded, // Negative amount for refund
    currency: charge.currency,
    status: 'refunded',
    description: 'Refund issued',
    paid_at: new Date().toISOString(),
  });

  console.log('Refund recorded for subscription:', subscription.id);
}

/**
 * Handle subscription update
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  console.log('Subscription updated:', stripeSubscription.id);

  // Find our subscription by Stripe subscription ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscription.id)
    .single();

  if (!subscription) {
    console.log('No subscription found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  // Update subscription status
  let status = 'active';
  if (stripeSubscription.status === 'canceled') status = 'canceled';
  if (stripeSubscription.status === 'past_due') status = 'payment_failed';
  if (stripeSubscription.status === 'unpaid') status = 'payment_failed';

  await supabase
    .from('subscriptions')
    .update({
      status,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', subscription.id);

  console.log('Subscription updated:', subscription.id, 'status:', status);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(stripeSubscription) {
  console.log('Subscription canceled:', stripeSubscription.id);

  // Find our subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, tenants(*)')
    .eq('stripe_subscription_id', stripeSubscription.id)
    .single();

  if (!subscription) {
    console.log('No subscription found for Stripe subscription:', stripeSubscription.id);
    return;
  }

  // Update subscription status to canceled
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      current_period_end: new Date().toISOString(), // End immediately
    })
    .eq('id', subscription.id);

  // Deactivate tenant
  await supabase
    .from('tenants')
    .update({ is_active: false })
    .eq('id', subscription.tenant_id);

  console.log('Subscription canceled and tenant deactivated:', subscription.tenant_id);
}

export default router;
