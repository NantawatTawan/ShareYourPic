import express from 'express';
import {
  getDisplayImages,
  getGalleryImages,
  getImageById,
  likeImage,
  commentImage,
  getComments
} from '../controllers/imageController.js';

const router = express.Router();

// ดึงรูปภาพสำหรับหน้า Display (โปรเจคเตอร์)
router.get('/display', getDisplayImages);

// ดึงรูปภาพสำหรับหน้า Gallery
router.get('/gallery', getGalleryImages);

// ดึงรูปภาพเดี่ยว
router.get('/:imageId', getImageById);

// ไลค์รูปภาพ (toggle)
router.post('/:imageId/like', likeImage);

// คอมเมนต์รูปภาพ
router.post('/:imageId/comment', commentImage);

// ดึงคอมเมนต์
router.get('/:imageId/comments', getComments);

export default router;
