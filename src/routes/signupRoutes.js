import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../config/database.js';
import { stripe } from '../config/stripe.js';
import { PRICING_PLANS } from '../config/pricing.js';

const router = express.Router();

// Helper: Generate random password
function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Helper: Generate random username
function generateUsername(shopName) {
  const base = shopName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.random().toString(36).substring(2, 6);
  return `${base}_${random}`;
}

// =============================================
// GET /api/check-slug/:slug
// ตรวจสอบว่า slug ว่างหรือไม่
// =============================================
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.json({ available: false, reason: 'invalid_format' });
    }

    if (slug.length < 3) {
      return res.json({ available: false, reason: 'too_short' });
    }

    // Check in database
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found (which is good)
      throw error;
    }

    res.json({ available: !data });
  } catch (error) {
    console.error('Error checking slug:', error);
    res.status(500).json({ error: 'Failed to check slug availability' });
  }
});

// =============================================
// POST /api/signup/trial
// สมัครใช้งานแบบ Free Trial
// =============================================
router.post('/signup/trial', async (req, res) => {
  try {
    const { shopName, shopSlug, ownerEmail, ownerPhone } = req.body;

    // Validation
    if (!shopName || !shopSlug || !ownerEmail || !ownerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check slug availability
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', shopSlug)
      .single();

    if (existingTenant) {
      return res.status(400).json({ error: 'Slug already taken' });
    }

    // Get trial plan
    const trialPlan = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', 'trial')
      .single();

    if (!trialPlan.data) {
      return res.status(500).json({ error: 'Trial plan not found' });
    }

    // Generate credentials
    const username = generateUsername(shopName);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        slug: shopSlug,
        name: shopName,
        description: '',
        owner_email: ownerEmail,
        owner_phone: ownerPhone,
        is_public: false,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Create subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan_id: trialPlan.data.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // +3 days
        auto_username: username,
        auto_password_hash: passwordHash,
        credentials_sent: false,
      })
      .select()
      .single();

    if (subscriptionError) throw subscriptionError;

    // Create admin user
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        tenant_id: tenant.id,
        is_super_admin: false,
        role: 'admin',
      })
      .select()
      .single();

    if (adminError) throw adminError;

    // TODO: Send email with credentials
    console.log('Trial account created:', {
      tenant: tenant.slug,
      username,
      password,
      loginUrl: `/${tenant.slug}/admin/login`,
    });

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      credentials: {
        username,
        password, // ⚠️ WARNING: Don't send in production, use email instead
        loginUrl: `/${tenant.slug}/admin/login`,
      },
      message: 'Trial account created successfully. Check your email for login details.',
    });
  } catch (error) {
    console.error('Error creating trial account:', error);
    res.status(500).json({ error: 'Failed to create trial account' });
  }
});

// =============================================
// POST /api/signup/create-payment
// สร้าง Payment Intent สำหรับ paid plan
// =============================================
router.post('/signup/create-payment', async (req, res) => {
  try {
    const { planKey, shopName, shopSlug, ownerEmail, ownerPhone } = req.body;

    // Validation
    if (!planKey || !shopName || !shopSlug || !ownerEmail || !ownerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get plan from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', planKey)
      .single();

    if (planError || !plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (plan.price_amount === 0) {
      return res.status(400).json({ error: 'This plan does not require payment' });
    }

    // Check slug availability
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', shopSlug)
      .single();

    if (existingTenant) {
      return res.status(400).json({ error: 'Slug already taken' });
    }

    // Create Stripe Customer
    const customer = await stripe.customers.create({
      email: ownerEmail,
      name: shopName,
      phone: ownerPhone,
      metadata: {
        plan_key: planKey,
        shop_slug: shopSlug,
      },
    });

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.price_amount,
      currency: plan.price_currency,
      customer: customer.id,
      receipt_email: ownerEmail,
      metadata: {
        plan_key: planKey,
        plan_name: plan.name,
        shop_name: shopName,
        shop_slug: shopSlug,
        owner_email: ownerEmail,
        owner_phone: ownerPhone,
      },
      description: `${plan.name} - ${shopName}`,
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// =============================================
// POST /api/signup/complete
// Complete signup after payment succeeds
// =============================================
router.post('/signup/complete', async (req, res) => {
  try {
    const { paymentIntentId, shopSlug } = req.body;

    if (!paymentIntentId || !shopSlug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const metadata = paymentIntent.metadata;

    // Check if tenant already exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', shopSlug)
      .single();

    if (existingTenant) {
      return res.status(400).json({ error: 'Tenant already created' });
    }

    // Get plan
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_key', metadata.plan_key)
      .single();

    if (!plan) {
      return res.status(400).json({ error: 'Plan not found' });
    }

    // Generate credentials
    const username = generateUsername(metadata.shop_name);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        slug: shopSlug,
        name: metadata.shop_name,
        description: '',
        owner_email: metadata.owner_email,
        owner_phone: metadata.owner_phone,
        is_public: false,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Calculate period end based on plan type
    let currentPeriodEnd;
    if (plan.billing_type === 'one_time') {
      currentPeriodEnd = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000);
    } else {
      // For subscriptions, set to 1 month or 1 year
      if (plan.billing_interval === 'month') {
        currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }
    }

    // Create subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        stripe_customer_id: paymentIntent.customer,
        stripe_payment_intent_id: paymentIntentId,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        auto_username: username,
        auto_password_hash: passwordHash,
        credentials_sent: false,
      })
      .select()
      .single();

    if (subscriptionError) throw subscriptionError;

    // Create admin user
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        tenant_id: tenant.id,
        is_super_admin: false,
        role: 'admin',
      })
      .select()
      .single();

    if (adminError) throw adminError;

    // Record in billing_history
    await supabase.from('billing_history').insert({
      tenant_id: tenant.id,
      subscription_id: subscription.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'paid',
      description: `Initial payment for ${plan.name}`,
      paid_at: new Date().toISOString(),
    });

    // TODO: Send email with credentials
    console.log('Paid account created:', {
      tenant: tenant.slug,
      username,
      password,
      loginUrl: `/${tenant.slug}/admin/login`,
    });

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      credentials: {
        username,
        password, // ⚠️ WARNING: Don't send in production, use email instead
        loginUrl: `/${tenant.slug}/admin/login`,
      },
      message: 'Account created successfully. Check your email for login details.',
    });
  } catch (error) {
    console.error('Error completing signup:', error);
    res.status(500).json({ error: 'Failed to complete signup' });
  }
});

export default router;
