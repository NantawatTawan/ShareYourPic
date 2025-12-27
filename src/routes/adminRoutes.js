import express from 'express';
import {
  login,
  getPendingImages,
  getAllImages,
  approveImage,
  rejectImage,
  deleteImageById,
  getStats,
  deleteComment
} from '../controllers/adminController.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes (ต้อง login)
router.get('/images/pending', authenticateAdmin, getPendingImages);
router.get('/images', authenticateAdmin, getAllImages);
router.put('/images/:imageId/approve', authenticateAdmin, approveImage);
router.put('/images/:imageId/reject', authenticateAdmin, rejectImage);
router.delete('/images/:imageId', authenticateAdmin, deleteImageById);
router.get('/stats', authenticateAdmin, getStats);
router.delete('/comments/:commentId', authenticateAdmin, deleteComment);

export default router;
