import express from 'express';
import path from 'path';
import { db } from '../../config/database.js';
import { loadTenant } from '../../middleware/tenant.js';
import { authenticateAdmin } from '../../middleware/auth.js';
import { checkTenantAccess } from '../../middleware/tenant.js';

const router = express.Router();

// ===========================================
// ADMIN ROUTES (ต้อง authenticate)
// ===========================================

// GET /:tenantSlug/admin/images - ดึงรูปทั้งหมด (สำหรับ admin)
router.get('/:tenantSlug/admin/images', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { status } = req.query;

    const images = await db.getImages({
      tenant_id: tenant.id,
      status: status || undefined,
      orderBy: 'uploaded_at',
      ascending: false
    });

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Get admin images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load images'
    });
  }
});

// PUT /:tenantSlug/admin/images/:imageId/approve - Approve รูป
router.put('/:tenantSlug/admin/images/:imageId/approve', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;
    const admin = req.admin;

    const image = await db.updateImage(imageId, {
      status: 'approved',
      approved_by: admin.id
    });

    // Emit socket event
    const io = req.app.get('io');
    io.emit('image:approved', { imageId, image });

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Approve image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve image'
    });
  }
});

// PUT /:tenantSlug/admin/images/:imageId/reject - Reject รูป
router.put('/:tenantSlug/admin/images/:imageId/reject', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const { imageId } = req.params;
    const { rejection_reason } = req.body;

    const image = await db.updateImage(imageId, {
      status: 'rejected',
      rejection_reason: rejection_reason || 'No reason provided'
    });

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Reject image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject image'
    });
  }
});

// DELETE /:tenantSlug/admin/images/:imageId - ลบรูป
router.delete('/:tenantSlug/admin/images/:imageId', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;

    // ดึงข้อมูลรูปก่อนลบ
    const image = await db.getImageById(imageId, tenant.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // ลบไฟล์ออกจาก storage
    const useSupabaseStorage = process.env.USE_SUPABASE_STORAGE === 'true';

    if (useSupabaseStorage) {
      const { supabase } = db;
      const filename = path.basename(image.file_url);

      await supabase.storage
        .from('tenant-images')
        .remove([`${tenant.slug}/images/${filename}`, `${tenant.slug}/thumbnails/${filename}`]);
    } else {
      const fs = await import('fs/promises');
      const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      const imagePath = path.join(uploadDir, tenant.slug, 'images', image.filename);
      const thumbnailPath = path.join(uploadDir, tenant.slug, 'thumbnails', image.filename);

      await fs.unlink(imagePath).catch(() => {});
      await fs.unlink(thumbnailPath).catch(() => {});
    }

    // ลบจาก database
    await db.deleteImage(imageId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image'
    });
  }
});

// GET /:tenantSlug/admin/stats - สถิติของร้าน
router.get('/:tenantSlug/admin/stats', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const tenant = req.tenant;

    const allImages = await db.getImages({ tenant_id: tenant.id });

    const stats = {
      total: allImages.length,
      pending: allImages.filter(img => img.status === 'pending').length,
      approved: allImages.filter(img => img.status === 'approved').length,
      rejected: allImages.filter(img => img.status === 'rejected').length,
      total_likes: allImages.reduce((sum, img) => sum + (img.like_count || 0), 0),
      total_comments: allImages.reduce((sum, img) => sum + (img.comment_count || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load statistics'
    });
  }
});

// PUT /:tenantSlug/admin/settings - แก้ไข settings ของร้าน
router.put('/:tenantSlug/admin/settings', loadTenant, authenticateAdmin, checkTenantAccess, async (req, res) => {
  try {
    const tenant = req.tenant;
    const {
      name,
      description,
      payment_enabled,
      price_amount,
      price_currency,
      display_duration,
      image_expiry_hours,
      max_images_per_user,
      theme_settings,
      display_settings
    } = req.body;

    // สร้าง object สำหรับ update
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (payment_enabled !== undefined) updates.payment_enabled = payment_enabled;
    if (price_amount !== undefined) updates.price_amount = price_amount;
    if (price_currency !== undefined) updates.price_currency = price_currency;
    if (display_duration !== undefined) updates.display_duration = display_duration;
    if (image_expiry_hours !== undefined) updates.image_expiry_hours = image_expiry_hours;
    if (max_images_per_user !== undefined) updates.max_images_per_user = max_images_per_user;
    if (theme_settings !== undefined) updates.theme_settings = theme_settings;
    if (display_settings !== undefined) updates.display_settings = display_settings;

    // อัปเดตข้อมูลใน database
    const updatedTenant = await db.updateTenant(tenant.id, updates);

    res.json({
      success: true,
      data: updatedTenant
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

export default router;
