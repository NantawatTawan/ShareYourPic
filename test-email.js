import { sendWelcomeEmail, sendPaymentReceipt } from './src/services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('Testing email service...');
  console.log('Sending to: tawannantawat@gmail.com');

  try {
    // Test welcome email
    console.log('\n1. Sending welcome email...');
    const result1 = await sendWelcomeEmail({
      to: 'tawannantawat@gmail.com',
      shopName: 'งานแต่งงานของเรา',
      shopSlug: 'test-wedding-2024',
      username: 'testuser_abc1',
      password: 'Test@Password123',
      planName: 'Professional (รายเดือน)',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });
    console.log('✅ Welcome email sent:', result1.id);

    // Test payment receipt
    console.log('\n2. Sending payment receipt...');
    const result2 = await sendPaymentReceipt({
      to: 'tawannantawat@gmail.com',
      shopName: 'งานแต่งงานของเรา',
      planName: 'Professional (รายเดือน)',
      amount: 89900, // 899 THB
      currency: 'thb',
      paymentIntentId: 'pi_test_1234567890',
      paidAt: new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
    console.log('✅ Payment receipt sent:', result2.id);

    console.log('\n✅ All emails sent successfully!');
    console.log('Check your inbox at: tawannantawat@gmail.com');

  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

testEmail();
