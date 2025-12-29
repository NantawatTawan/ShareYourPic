import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { db } from '../../config/database.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// ===========================================
// STRIPE WEBHOOK
// ===========================================

// POST /webhook/stripe - Stripe webhook handler
// Note: ต้องใช้ raw body ไม่ใช่ JSON parsed
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // ถ้าไม่มี webhook secret ให้ใช้ body ตรงๆ (development only)
      event = JSON.parse(req.body.toString());
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);

        // อัปเดต payment status ใน database
        await db.updatePaymentStatus(paymentIntent.id, 'succeeded');
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);

        // อัปเดต payment status ใน database
        await db.updatePaymentStatus(failedPayment.id, 'failed');
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
