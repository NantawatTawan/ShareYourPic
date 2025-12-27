import express from 'express';
import { createPaymentIntent, uploadImage, getUploadStatus } from '../controllers/uploadController.js';

const router = express.Router();

// สร้าง Payment Intent
router.post('/payment/create', createPaymentIntent);

// อัปโหลดรูปภาพ (หลังจากชำระเงินสำเร็จ)
router.post('/upload', uploadImage);

// ตรวจสอบสถานะการอัปโหลด
router.get('/upload/:imageId/status', getUploadStatus);

export default router;
