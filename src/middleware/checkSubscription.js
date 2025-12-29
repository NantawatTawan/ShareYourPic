import { supabase } from '../config/database.js';

/**
 * Middleware to check if tenant's subscription is active
 * Use this on routes that require active subscription (display, gallery, admin)
 */
export async function requireActiveSubscription(req, res, next) {
  const tenantSlug = req.params.tenantSlug || req.query.tenantSlug || req.body.tenantSlug;

  if (!tenantSlug) {
    return res.status(400).json({ error: 'Tenant slug required' });
  }

  try {
    // Get tenant with subscription
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select(`
        *,
        subscriptions!inner (
          *,
          subscription_plans (*)
        )
      `)
      .eq('slug', tenantSlug)
      .eq('subscriptions.status', 'active')
      .single();

    if (tenantError || !tenant) {
      return res.status(403).json({
        error: 'Subscription expired or not found',
        message: 'Your subscription has expired. Please renew to continue using the service.',
      });
    }

    // Check if tenant is active
    if (!tenant.is_active) {
      return res.status(403).json({
        error: 'Tenant inactive',
        message: 'This account has been deactivated. Please contact support.',
      });
    }

    // Get active subscription
    const subscription = tenant.subscriptions[0];

    // Check if subscription has expired
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);

    if (now > periodEnd) {
      // Mark as expired
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', subscription.id);

      await supabase
        .from('tenants')
        .update({ is_active: false })
        .eq('id', tenant.id);

      return res.status(403).json({
        error: 'Subscription expired',
        message: 'Your subscription expired on ' + periodEnd.toLocaleDateString('th-TH'),
        expired_at: periodEnd,
      });
    }

    // Attach tenant and subscription to request
    req.tenant = tenant;
    req.subscription = subscription;
    req.plan = subscription.subscription_plans;

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
}

/**
 * Get days until subscription expires
 */
export function getDaysUntilExpiry(subscription) {
  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  const diffTime = periodEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if subscription is expiring soon (within 7 days)
 */
export function isExpiringSoon(subscription) {
  const daysLeft = getDaysUntilExpiry(subscription);
  return daysLeft <= 7 && daysLeft > 0;
}
