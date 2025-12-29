import express from 'express';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { db } from '../../config/database.js';
import { loadTenant } from '../../middleware/tenant.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// POST /:tenantSlug/payment/create - สร้าง payment intent
router.post('/:tenantSlug/payment/create', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
    const { session_id } = req.body;

    console.log('[Payment Create] Tenant:', tenant.slug, 'Session:', session_id);

    // ตรวจสอบว่าต้องจ่ายเงินหรือไม่
    if (!tenant.payment_enabled) {
      return res.json({
        success: true,
        payment_required: false,
        message: 'This tenant does not require payment'
      });
    }

    // ตรวจสอบว่ามี Stripe key หรือไม่
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[Payment Create] STRIPE_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        message: 'Payment system is not configured'
      });
    }

    // ใช้ราคาจาก tenant settings
    const amount = tenant.price_amount;
    const currency = tenant.price_currency || 'thb';

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    console.log('[Payment Create] Amount:', amount, 'Currency:', currency);

    // กำหนด payment methods ที่รองรับตาม currency
    let paymentMethodTypes = ['card'];

    // PromptPay รองรับเฉพาะ THB
    if (currency.toLowerCase() === 'thb') {
      paymentMethodTypes.push('promptpay');
    }

    console.log('[Payment Create] Payment methods:', paymentMethodTypes);

    // สร้าง PaymentIntent
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        payment_method_types: paymentMethodTypes,
        metadata: {
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          session_id: session_id || 'unknown'
        }
      });
      console.log('[Payment Create] PaymentIntent created:', paymentIntent.id);
    } catch (stripeError) {
      console.error('[Payment Create] Stripe error:', stripeError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment with Stripe: ' + stripeError.message
      });
    }

    // บันทึกลง database
    try {
      await db.createPayment({
        tenant_id: tenant.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount,
        currency,
        status: 'pending',
        session_id,
        metadata: paymentIntent.metadata
      });
      console.log('[Payment Create] Payment saved to database');
    } catch (dbError) {
      console.error('[Payment Create] Database error:', dbError.message);
      // PaymentIntent already created, but DB save failed
      // We should still return success so user can complete payment
    }

    res.json({
      success: true,
      payment_required: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency
    });
  } catch (error) {
    console.error('[Payment Create] Unexpected error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment: ' + (error.message || 'Unknown error')
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

      // ตรวจสอบ payment จาก Stripe โดยตรง
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('[Upload] Payment status from Stripe:', paymentIntent.status);
      } catch (stripeError) {
        console.error('[Upload] Stripe retrieve error:', stripeError.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid payment ID'
        });
      }

      // ตรวจสอบว่าจ่ายเงินสำเร็จแล้ว
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment not completed. Status: ' + paymentIntent.status
        });
      }

      // ตรวจสอบว่า payment นี้เป็นของร้านนี้ไหม
      if (paymentIntent.metadata.tenant_id !== tenant.id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Payment does not belong to this tenant'
        });
      }

      // Update payment status in database
      try {
        await db.updatePaymentStatus(paymentIntentId, 'succeeded');
      } catch (dbError) {
        console.error('[Upload] Failed to update payment status:', dbError.message);
        // Don't block upload if DB update fails
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

export default router;
