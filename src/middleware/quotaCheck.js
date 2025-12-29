import { supabase } from '../config/database.js';

/**
 * Check if tenant has exceeded their quota
 * @param {string} tenantId - Tenant ID to check
 * @returns {Object} - { allowed: boolean, reason: string, usage: object }
 */
export async function checkQuota(tenantId) {
  try {
    // Get tenant with subscription and plan info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select(`
        *,
        subscriptions (
          *,
          subscription_plans (*)
        )
      `)
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return {
        allowed: false,
        reason: 'Tenant not found',
        usage: null,
      };
    }

    // Check if tenant is active
    if (!tenant.is_active) {
      return {
        allowed: false,
        reason: 'Tenant is not active',
        usage: null,
      };
    }

    // Get active subscription
    const activeSubscription = tenant.subscriptions.find(sub => sub.status === 'active');

    if (!activeSubscription) {
      return {
        allowed: false,
        reason: 'No active subscription',
        usage: null,
      };
    }

    const plan = activeSubscription.subscription_plans;

    // Check if subscription has expired
    const now = new Date();
    const periodEnd = new Date(activeSubscription.current_period_end);

    if (now > periodEnd) {
      return {
        allowed: false,
        reason: 'Subscription expired',
        usage: {
          period_end: periodEnd,
        },
      };
    }

    // Get max uploads from features
    // For one-time plans: features.max_uploads
    // For subscription plans: features.max_uploads_per_month
    const features = plan.features || {};
    const maxUploads = features.max_uploads || features.max_uploads_per_month || -1;

    // Count current images
    const { count: imageCount, error: countError } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) {
      console.error('Error counting images:', countError);
      return {
        allowed: true, // Allow on error (don't block user)
        reason: 'Error checking quota',
        usage: null,
      };
    }

    // Check image limit (-1 means unlimited)
    if (maxUploads !== -1 && imageCount >= maxUploads) {
      return {
        allowed: false,
        reason: 'Image limit reached',
        usage: {
          current: imageCount,
          limit: maxUploads,
          plan: plan.name,
          storage_limit_gb: features.storage_gb || 0,
        },
      };
    }

    // Check storage limit (if applicable)
    // TODO: Implement storage size checking

    // All checks passed
    return {
      allowed: true,
      reason: 'OK',
      usage: {
        current: imageCount,
        limit: maxUploads,
        plan: plan.name,
        period_end: periodEnd,
        storage_limit_gb: features.storage_gb || 0,
      },
    };
  } catch (error) {
    console.error('Error in checkQuota:', error);
    return {
      allowed: true, // Allow on error (don't block user)
      reason: 'Error checking quota',
      usage: null,
    };
  }
}

/**
 * Express middleware to check quota before upload
 */
export async function requireQuota(req, res, next) {
  const tenantId = req.tenantId || req.body.tenant_id || req.query.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }

  const quota = await checkQuota(tenantId);

  if (!quota.allowed) {
    return res.status(403).json({
      error: quota.reason,
      usage: quota.usage,
    });
  }

  // Attach quota info to request for later use
  req.quota = quota;
  next();
}

/**
 * Get quota usage for a tenant (for display in admin panel)
 */
export async function getQuotaUsage(tenantId) {
  const quota = await checkQuota(tenantId);
  return quota;
}
