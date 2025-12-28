import express from 'express';
import { db } from '../config/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/tenant.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// ต้อง authenticate ทุก route
router.use(authenticateAdmin);
router.use(requireSuperAdmin);

// ===========================================
// TENANT MANAGEMENT
// ===========================================

// GET /super-admin/tenants - ดึงร้านทั้งหมด
router.get('/tenants', async (req, res) => {
  try {
    const { is_active } = req.query;

    const filters = {};
    if (is_active !== undefined) {
      filters.is_active = is_active === 'true';
    }

    const tenants = await db.getAllTenants(filters);

    res.json({
      success: true,
      data: tenants
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load tenants'
    });
  }
});

// POST /super-admin/tenants - สร้างร้านใหม่
router.post('/tenants', async (req, res) => {
  try {
    const {
      slug,
      name,
      description,
      owner_email,
      owner_phone,
      theme_settings,
      payment_enabled,
      price_amount,
      price_currency,
      display_duration,
      image_expiry_hours,
      max_images_per_user
    } = req.body;

    if (!slug || !name) {
      return res.status(400).json({
        success: false,
        message: 'Slug and name are required'
      });
    }

    // ตรวจสอบว่า slug ซ้ำหรือไม่
    const existing = await db.getTenantBySlug(slug);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Slug already exists'
      });
    }

    const tenantData = {
      slug,
      name,
      description,
      owner_email,
      owner_phone,
      payment_enabled: payment_enabled !== undefined ? payment_enabled : true,
      price_amount: price_amount || 3500,
      price_currency: price_currency || 'thb',
      display_duration: display_duration || 5,
      image_expiry_hours: image_expiry_hours || 1,
      max_images_per_user: max_images_per_user || 10
    };

    if (theme_settings) {
      tenantData.theme_settings = theme_settings;
    }

    const tenant = await db.createTenant(tenantData);

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tenant'
    });
  }
});

// PUT /super-admin/tenants/:tenantId - แก้ไขร้าน
router.put('/tenants/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;

    // ห้ามแก้ id และ slug (เพื่อความปลอดภัย)
    delete updates.id;
    // อนุญาตให้แก้ slug ได้ แต่ต้องตรวจสอบว่าไม่ซ้ำ
    if (updates.slug) {
      const existing = await db.getTenantBySlug(updates.slug);
      if (existing && existing.id !== tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Slug already exists'
        });
      }
    }

    const tenant = await db.updateTenant(tenantId, updates);

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant'
    });
  }
});

// DELETE /super-admin/tenants/:tenantId - ลบร้าน
router.delete('/tenants/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    await db.deleteTenant(tenantId);

    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tenant'
    });
  }
});

// ===========================================
// ADMIN MANAGEMENT
// ===========================================

// GET /super-admin/admins - ดึง admin ทั้งหมด
router.get('/admins', async (req, res) => {
  try {
    const { data: admins, error } = await db.supabase
      .from('admins')
      .select(`
        id,
        username,
        tenant_id,
        role,
        is_super_admin,
        created_at,
        tenants (
          slug,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: admins
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load admins'
    });
  }
});

// POST /super-admin/admins - สร้าง admin ใหม่
router.post('/admins', async (req, res) => {
  try {
    const { username, password, tenant_id, is_super_admin } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // ถ้าไม่ใช่ super admin ต้องระบุ tenant_id
    if (!is_super_admin && !tenant_id) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required for regular admins'
      });
    }

    // ตรวจสอบว่า username ซ้ำหรือไม่
    const existing = await db.getAdminByUsername(username);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await db.createAdmin(
      username,
      passwordHash,
      is_super_admin ? null : tenant_id,
      is_super_admin || false
    );

    res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        tenant_id: admin.tenant_id,
        is_super_admin: admin.is_super_admin,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin'
    });
  }
});

// DELETE /super-admin/admins/:adminId - ลบ admin
router.delete('/admins/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;

    // ห้ามลบตัวเอง
    if (adminId === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete yourself'
      });
    }

    const { error } = await db.supabase
      .from('admins')
      .delete()
      .eq('id', adminId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin'
    });
  }
});

// ===========================================
// GLOBAL STATISTICS
// ===========================================

// GET /super-admin/stats - สถิติรวมทั้งหมด
router.get('/stats', async (req, res) => {
  try {
    const { data: tenants } = await db.supabase
      .from('tenants')
      .select('id, slug, name, is_active');

    const { data: images } = await db.supabase
      .from('images_with_stats')
      .select('*');

    const { data: payments } = await db.supabase
      .from('payments')
      .select('amount, currency, status, tenant_id');

    const stats = {
      total_tenants: tenants?.length || 0,
      active_tenants: tenants?.filter(t => t.is_active).length || 0,
      total_images: images?.length || 0,
      pending_images: images?.filter(img => img.status === 'pending').length || 0,
      approved_images: images?.filter(img => img.status === 'approved').length || 0,
      rejected_images: images?.filter(img => img.status === 'rejected').length || 0,
      total_revenue: payments?.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + p.amount, 0) || 0,
      total_payments: payments?.filter(p => p.status === 'succeeded').length || 0
    };

    // สถิติแยกตามร้าน
    const tenantStats = tenants?.map(tenant => {
      const tenantImages = images?.filter(img => img.tenant_id === tenant.id) || [];
      const tenantPayments = payments?.filter(p => p.tenant_id === tenant.id && p.status === 'succeeded') || [];

      return {
        tenant_id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        is_active: tenant.is_active,
        total_images: tenantImages.length,
        pending: tenantImages.filter(img => img.status === 'pending').length,
        approved: tenantImages.filter(img => img.status === 'approved').length,
        rejected: tenantImages.filter(img => img.status === 'rejected').length,
        revenue: tenantPayments.reduce((sum, p) => sum + p.amount, 0),
        payments_count: tenantPayments.length
      };
    }) || [];

    res.json({
      success: true,
      data: {
        overview: stats,
        tenants: tenantStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load statistics'
    });
  }
});

export default router;
