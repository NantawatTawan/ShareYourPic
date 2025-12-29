import express from 'express';
import { db } from '../../config/database.js';
import { loadTenant } from '../../middleware/tenant.js';

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
        description: tenant.description,
        theme: tenant.theme_settings,
        display_settings: tenant.display_settings,
        payment_enabled: tenant.payment_enabled,
        price_amount: tenant.price_amount,
        price_currency: tenant.price_currency,
        display_duration: tenant.display_duration
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
    const { sort, session_id } = req.query;

    console.log('🔍 [GALLERY] Received sort parameter:', sort);
    console.log('🔍 [GALLERY] Session ID:', session_id);

    // Fetch images from database
    let images = await db.getImages({
      tenant_id: tenant.id,
      status: 'approved',
      orderBy: 'approved_at',
      ascending: false
    });

    console.log('🔍 [GALLERY] Total images:', images.length);
    console.log('🔍 [GALLERY] Images before sort:', images.slice(0, 3).map(img => ({
      id: img.id.substring(0, 8),
      likes: img.like_count,
      comments: img.comment_count,
      approved: img.approved_at
    })));

    // Sort based on query parameter
    switch (sort) {
      case 'latest':
        images.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
        break;
      case 'oldest':
        images.sort((a, b) => new Date(a.approved_at) - new Date(b.approved_at));
        break;
      case 'most_liked':
        images.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;
      case 'most_commented':
        images.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
        break;
      default:
        // Default: latest first
        images.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    }

    console.log('✅ [GALLERY] Images after sort:', images.slice(0, 3).map(img => ({
      id: img.id.substring(0, 8),
      likes: img.like_count,
      comments: img.comment_count,
      approved: img.approved_at
    })));

    // Add hasLiked status for each image
    if (session_id) {
      const imagesWithLikeStatus = await Promise.all(
        images.map(async (image) => {
          const hasLiked = await db.hasUserLiked(image.id, session_id);
          return {
            ...image,
            hasLiked
          };
        })
      );

      res.json({
        success: true,
        data: imagesWithLikeStatus
      });
    } else {
      // No session_id, return images without hasLiked
      res.json({
        success: true,
        data: images.map(img => ({ ...img, hasLiked: false }))
      });
    }
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
    const { session_id } = req.query;

    const image = await db.getImageById(imageId, tenant.id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has liked this image
    let hasLiked = false;
    if (session_id) {
      hasLiked = await db.hasUserLiked(imageId, session_id);
    }

    res.json({
      success: true,
      data: {
        ...image,
        hasLiked
      }
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

export default router;
