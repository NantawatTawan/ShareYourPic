import express from 'express';
import { db } from '../config/database.js';
import { loadTenant } from '../middleware/tenant.js';
import { authenticateAdmin, generateToken } from '../middleware/auth.js';
import { checkTenantAccess } from '../middleware/tenant.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { PAYMENT_AMOUNT, PAYMENT_CURRENCY } from '../config/stripe.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// ===========================================
// PUBLIC ROUTES (ไม่ต้อง authenticate)
// ===========================================

// GET /:tenantSlug/theme - ดึง theme settings
router.get('/:tenantSlug/theme', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    res.json({
      success: true,
      data: {
        name: tenant.name,
        slug: tenant.slug,
        theme: tenant.theme_settings,
        payment_enabled: tenant.payment_enabled,
        price_amount: tenant.price_amount,
        price_currency: tenant.price_currency
      }
    });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load theme'
    });
  }
});

// GET /:tenantSlug/images/display - ดึงรูปสำหรับ display page
router.get('/:tenantSlug/images/display', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    const images = await db.getImages({
      tenant_id: tenant.id,
      status: 'approved',
      notExpired: true,
      orderBy: 'approved_at',
      ascending: false
    });

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Get display images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load images'
    });
  }
});

// GET /:tenantSlug/images/gallery - ดึงรูปสำหรับ gallery page
router.get('/:tenantSlug/images/gallery', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;

    const images = await db.getImages({
      tenant_id: tenant.id,
      status: 'approved',
      orderBy: 'approved_at',
      ascending: false
    });

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Get gallery images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load images'
    });
  }
});

// GET /:tenantSlug/images/:imageId - ดึงรูปเดี่ยว
router.get('/:tenantSlug/images/:imageId', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;

    const image = await db.getImageById(imageId, tenant.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load image'
    });
  }
});

// POST /:tenantSlug/images/:imageId/like - กดไลค์
router.post('/:tenantSlug/images/:imageId/like', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // ตรวจสอบว่าไลค์แล้วหรือยัง
    const hasLiked = await db.hasUserLiked(imageId, session_id);

    if (hasLiked) {
      // Unlike
      await db.removeLike(imageId, session_id, tenant.id);
      const likeCount = await db.getLikeCount(imageId);

      // Emit socket event
      const io = req.app.get('io');
      io.emit('image:unliked', { imageId, likeCount });

      return res.json({
        success: true,
        liked: false,
        likeCount
      });
    } else {
      // Like
      const ipAddress = req.ip || req.connection.remoteAddress;
      await db.addLike(imageId, session_id, tenant.id, ipAddress);
      const likeCount = await db.getLikeCount(imageId);

      // Emit socket event
      const io = req.app.get('io');
      io.emit('image:liked', { imageId, likeCount });

      return res.json({
        success: true,
        liked: true,
        likeCount
      });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process like'
    });
  }
});

// GET /:tenantSlug/images/:imageId/comments - ดึง comments
router.get('/:tenantSlug/images/:imageId/comments', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;

    const comments = await db.getComments(imageId, tenant.id);

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load comments'
    });
  }
});

// POST /:tenantSlug/images/:imageId/comment - เพิ่ม comment
router.post('/:tenantSlug/images/:imageId/comment', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { imageId } = req.params;
    const { session_id, comment_text } = req.body;

    if (!session_id || !comment_text) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and comment text are required'
      });
    }

    if (comment_text.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment too long (max 500 characters)'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const comment = await db.addComment(imageId, session_id, tenant.id, comment_text, ipAddress);

    // Emit socket event
    const io = req.app.get('io');
    io.emit('image:commented', { imageId, comment });

    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// POST /:tenantSlug/payment/create - สร้าง payment intent
router.post('/:tenantSlug/payment/create', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { session_id } = req.body;

    // ตรวจสอบว่าต้องจ่ายเงินหรือไม่
    if (!tenant.payment_enabled) {
      return res.json({
        success: true,
        payment_required: false,
        message: 'This tenant does not require payment'
      });
    }

    // ใช้ราคาจาก tenant settings
    const amount = tenant.price_amount;
    const currency = tenant.price_currency;

    // สร้าง PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        session_id: session_id || 'unknown'
      }
    });

    // บันทึกลง database
    await db.createPayment({
      tenant_id: tenant.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount,
      currency,
      status: 'pending',
      session_id,
      metadata: paymentIntent.metadata
    });

    res.json({
      success: true,
      payment_required: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment'
    });
  }
});

// POST /:tenantSlug/upload - อัปโหลดรูป
router.post('/:tenantSlug/upload', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { paymentIntentId, session_id } = req.body;

    // ตรวจสอบว่าต้องจ่ายเงินหรือไม่
    if (tenant.payment_enabled) {
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment is required'
        });
      }

      // ตรวจสอบ payment
      const payment = await db.getPaymentByStripeId(paymentIntentId);

      if (!payment || payment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment not found or not completed'
        });
      }

      // ตรวจสอบว่า payment นี้เป็นของร้านนี้ไหม
      if (payment.tenant_id !== tenant.id) {
        return res.status(400).json({
          success: false,
          message: 'Payment does not belong to this tenant'
        });
      }
    }

    // ตรวจสอบไฟล์
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    const imageFile = req.files.image;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP are allowed'
      });
    }

    // สร้างชื่อไฟล์
    const fileExt = path.extname(imageFile.name);
    const filename = `${crypto.randomUUID()}${fileExt}`;

    // ใช้ Supabase Storage หรือ local storage
    const useSupabaseStorage = process.env.USE_SUPABASE_STORAGE === 'true';

    let fileUrl, thumbnailUrl;

    if (useSupabaseStorage) {
      // Upload to Supabase Storage
      const { supabase } = db;

      // Process image
      const processedImage = await sharp(imageFile.data)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const thumbnail = await sharp(imageFile.data)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload paths: tenant-images/{tenant_slug}/images/{filename}
      const imagePath = `${tenant.slug}/images/${filename}`;
      const thumbnailPath = `${tenant.slug}/thumbnails/${filename}`;

      // Upload original
      const { error: imageError } = await supabase.storage
        .from('tenant-images')
        .upload(imagePath, processedImage, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (imageError) throw imageError;

      // Upload thumbnail
      const { error: thumbError } = await supabase.storage
        .from('tenant-images')
        .upload(thumbnailPath, thumbnail, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (thumbError) throw thumbError;

      // Get public URLs
      const { data: imageUrlData } = supabase.storage
        .from('tenant-images')
        .getPublicUrl(imagePath);

      const { data: thumbUrlData } = supabase.storage
        .from('tenant-images')
        .getPublicUrl(thumbnailPath);

      fileUrl = imageUrlData.publicUrl;
      thumbnailUrl = thumbUrlData.publicUrl;

    } else {
      // Local storage (fallback)
      const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      const tenantDir = path.join(uploadDir, tenant.slug);
      const imagesDir = path.join(tenantDir, 'images');
      const thumbnailsDir = path.join(tenantDir, 'thumbnails');

      // Create directories
      const fs = await import('fs/promises');
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.mkdir(thumbnailsDir, { recursive: true });

      const imagePath = path.join(imagesDir, filename);
      const thumbnailPath = path.join(thumbnailsDir, filename);

      // Process and save
      await sharp(imageFile.data)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(imagePath);

      await sharp(imageFile.data)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      fileUrl = `/uploads/${tenant.slug}/images/${filename}`;
      thumbnailUrl = `/uploads/${tenant.slug}/thumbnails/${filename}`;
    }

    // Get image metadata
    const metadata = await sharp(imageFile.data).metadata();

    // สร้าง record ใน database
    const image = await db.createImage({
      tenant_id: tenant.id,
      payment_id: tenant.payment_enabled ? (await db.getPaymentByStripeId(paymentIntentId)).id : null,
      filename,
      original_filename: imageFile.name,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      file_size: imageFile.size,
      mime_type: imageFile.mimetype,
      width: metadata.width,
      height: metadata.height,
      status: 'pending',
      upload_session_id: session_id
    });

    res.json({
      success: true,
      data: image
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image'
    });
  }
});

// ===========================================
// ADMIN ROUTES (ต้อง authenticate)
// ===========================================

// POST /:tenantSlug/admin/login - Admin login
router.post('/:tenantSlug/admin/login', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // ดึงข้อมูล admin
    const admin = await db.getAdminByUsername(username);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // ตรวจสอบว่า admin นี้เป็นของร้านนี้หรือเป็น super admin
    if (!admin.is_super_admin && admin.tenant_id !== tenant.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this tenant'
      });
    }

    // ตรวจสอบรหัสผ่าน
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // สร้าง JWT token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      tenant_id: admin.tenant_id,
      is_super_admin: admin.is_super_admin,
      role: admin.role
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        tenant_id: admin.tenant_id,
        is_super_admin: admin.is_super_admin,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

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

export default router;
