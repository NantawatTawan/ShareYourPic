import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe Secret Key. Please check your .env file.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const PAYMENT_AMOUNT = 3500; // ฿35 THB (in satang) - minimum 20 baht
export const PAYMENT_CURRENCY = 'thb';

export default stripe;
