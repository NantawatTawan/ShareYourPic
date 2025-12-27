import db from '../config/database.js';
import stripe, { PAYMENT_AMOUNT, PAYMENT_CURRENCY } from '../config/stripe.js';
// เลือกใช้ storage แบบไหนตาม environment
import * as localStorage from '../utils/fileHandler.js';
import * as supabaseStorage from '../utils/supabaseStorage.js';
import { generateSessionId, getClientIp } from '../utils/session.js';

// ใช้ Supabase Storage ถ้าเป็น production, ไม่งั้นใช้ local
const USE_SUPABASE_STORAGE = process.env.USE_SUPABASE_STORAGE === 'true' || process.env.NODE_ENV === 'production';
const storage = USE_SUPABASE_STORAGE ? supabaseStorage : localStorage;
const { validateFile, saveImage, deleteImage } = storage;

// สร้าง Payment Intent สำหรับ Stripe
// รองรับ Google Pay, Apple Pay, PromptPay และ cards
export const createPaymentIntent = async (req, res) => {
  try {
    const sessionId = generateSessionId(req);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PAYMENT_AMOUNT,
      currency: PAYMENT_CURRENCY,
      // เปิดใช้งาน automatic payment methods (Google Pay, Apple Pay, cards, PromptPay)
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        session_id: sessionId
      }
    });

    // บันทึกข้อมูล payment ลง database
    await db.createPayment({
      stripe_payment_intent_id: paymentIntent.id,
      amount: PAYMENT_AMOUNT,
      currency: PAYMENT_CURRENCY,
      status: 'pending',
      session_id: sessionId
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};

// อัปโหลดรูปภาพหลังจากชำระเงินสำเร็จ
export const uploadImage = async (req, res) => {
  try {
    const { paymentIntentId, caption } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    // ตรวจสอบว่ามีไฟล์หรือไม่
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageFile = req.files.image;

    // Validate file
    validateFile(imageFile);

    // ตรวจสอบ payment ว่าชำระเงินสำเร็จแล้ว
    const payment = await db.getPaymentByStripeId(paymentIntentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // ตรวจสอบสถานะการชำระเงินจาก Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // อัพเดทสถานะ payment
    await db.updatePayment(payment.id, { status: 'succeeded' });

    // บันทึกรูปภาพ
    const savedImage = await saveImage(imageFile);

    const sessionId = generateSessionId(req);

    // บันทึกข้อมูลรูปภาพลง database
    const image = await db.createImage({
      payment_id: payment.id,
      filename: savedImage.filename,
      original_filename: savedImage.originalFilename,
      file_url: savedImage.fileUrl,
      thumbnail_url: savedImage.thumbnailUrl,
      file_size: savedImage.fileSize,
      mime_type: savedImage.mimeType,
      width: savedImage.width,
      height: savedImage.height,
      status: 'pending',
      upload_session_id: sessionId,
      caption: caption || null // เพิ่ม caption
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      image: {
        id: image.id,
        status: image.status,
        thumbnail_url: image.thumbnail_url
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

// ตรวจสอบสถานะการอัปโหลด
export const getUploadStatus = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      image: {
        id: image.id,
        status: image.status,
        thumbnail_url: image.thumbnail_url,
        approved_at: image.approved_at,
        expires_at: image.expires_at
      }
    });
  } catch (error) {
    console.error('Get upload status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload status',
      error: error.message
    });
  }
};

export default {
  createPaymentIntent,
  uploadImage,
  getUploadStatus
};
