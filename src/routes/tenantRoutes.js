import express from 'express';
import publicRoutes from './tenant/publicRoutes.js';
import uploadRoutes from './tenant/uploadRoutes.js';
import adminAuthRoutes from './tenant/adminAuthRoutes.js';
import adminRoutes from './tenant/adminRoutes.js';
import webhookRoutes from './tenant/webhookRoutes.js';

const router = express.Router();

// Mount all tenant route modules
router.use('/', publicRoutes);      // Public routes (theme, images display/gallery, likes, comments)
router.use('/', uploadRoutes);       // Upload and payment routes
router.use('/', adminAuthRoutes);    // Admin authentication
router.use('/', adminRoutes);        // Admin management routes
router.use('/', webhookRoutes);      // Stripe webhook

export default router;
