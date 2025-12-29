import { db } from '../config/database.js';

// Middleware สำหรับดึงข้อมูล tenant จาก slug
export const loadTenant = async (req, res, next) => {
  try {
    const tenantSlug = req.params.tenantSlug || req.body.tenantSlug || req.query.tenantSlug;

    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Tenant slug is required'
      });
    }

    // ดึงข้อมูล tenant พร้อม subscription
    const { data: tenant, error } = await db.supabase
      .from('tenants')
      .select(`
        *,
        subscriptions (
          *,
          subscription_plans (*)
        )
      `)
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .single();

    if (error || !tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found or inactive'
      });
    }

    // เช็ค subscription
    const activeSubscription = tenant.subscriptions?.find(sub => sub.status === 'active');

    if (!activeSubscription) {
      return res.status(403).json({
        success: false,
        message: 'Subscription expired or not found',
        redirect: '/pricing', // ให้ frontend redirect ไป pricing
      });
    }

    // เช็ควันหมดอายุ
    const now = new Date();
    const periodEnd = new Date(activeSubscription.current_period_end);

    if (now > periodEnd) {
      // อัพเดทสถานะเป็น expired
      await db.supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', activeSubscription.id);

      await db.supabase
        .from('tenants')
        .update({ is_active: false })
        .eq('id', tenant.id);

      return res.status(403).json({
        success: false,
        message: 'Subscription expired on ' + periodEnd.toLocaleDateString('th-TH'),
        expired_at: periodEnd,
        redirect: '/pricing',
      });
    }

    // เก็บข้อมูล tenant, subscription, plan ไว้ใน request object
    req.tenant = tenant;
    req.subscription = activeSubscription;
    req.plan = activeSubscription.subscription_plans;

    // เช็คว่าใกล้หมดอายุไหม (7 วัน)
    const diffTime = periodEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    req.daysUntilExpiry = diffDays;
    req.isExpiringSoon = diffDays <= 7 && diffDays > 0;

    next();
  } catch (error) {
    console.error('Load tenant error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load tenant information'
    });
  }
};

// Middleware สำหรับตรวจสอบว่า admin มีสิทธิ์เข้าถึงร้านนี้ไหม
export const checkTenantAccess = async (req, res, next) => {
  try {
    const admin = req.admin; // มาจาก authenticateAdmin middleware
    const tenant = req.tenant; // มาจาก loadTenant middleware

    if (!admin || !tenant) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // ถ้าเป็น super admin ให้ผ่านทันที
    if (admin.is_super_admin) {
      return next();
    }

    // ตรวจสอบว่า admin นี้เป็นของร้านนี้ไหม
    if (admin.tenant_id !== tenant.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this tenant'
      });
    }

    next();
  } catch (error) {
    console.error('Check tenant access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify tenant access'
    });
  }
};

// Middleware สำหรับตรวจสอบว่าเป็น super admin
export const requireSuperAdmin = (req, res, next) => {
  const admin = req.admin;

  if (!admin || !admin.is_super_admin) {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }

  next();
};

export default {
  loadTenant,
  checkTenantAccess,
  requireSuperAdmin
};
