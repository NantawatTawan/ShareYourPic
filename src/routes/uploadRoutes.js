import express from 'express';
import { createPaymentIntent, uploadImage, getUploadStatus } from '../controllers/uploadController.js';
import { requireQuota } from '../middleware/quotaCheck.js';

const router = express.Router();

// สร้าง Payment Intent
router.post('/payment/create', createPaymentIntent);

// อัปโหลดรูปภาพ (หลังจากชำระเงินสำเร็จ) - เช็ค quota ก่อน
router.post('/upload', requireQuota, uploadImage);

// ตรวจสอบสถานะการอัปโหลด
router.get('/upload/:imageId/status', getUploadStatus);

export default router;
