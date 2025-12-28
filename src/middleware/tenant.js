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

    // ดึงข้อมูล tenant จาก database
    const { data: tenant, error } = await db.supabase
      .from('tenants')
      .select('*')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .single();

    if (error || !tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found or inactive'
      });
    }

    // เก็บข้อมูล tenant ไว้ใน request object
    req.tenant = tenant;
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
