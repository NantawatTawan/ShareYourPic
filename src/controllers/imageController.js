import db from '../config/database.js';
import { generateSessionId, getClientIp } from '../utils/session.js';

// ดึงรูปภาพสำหรับหน้า Display (โปรเจคเตอร์) - รูปที่ approved และยังไม่หมดอายุ
export const getDisplayImages = async (req, res) => {
  try {
    const images = await db.getImages({
      status: 'approved',
      notExpired: true,
      orderBy: 'approved_at',
      ascending: false
    });

    res.json({
      success: true,
      images
    });
  } catch (error) {
    console.error('Get display images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get display images',
      error: error.message
    });
  }
};

// ดึงรูปภาพสำหรับหน้า Gallery - รูปทั้งหมดที่ approved (ไม่สนใจหมดอายุ)
export const getGalleryImages = async (req, res) => {
  try {
    const { sort = 'latest', limit = 50, offset = 0 } = req.query;

    let orderBy = 'approved_at';
    let ascending = false;

    switch (sort) {
      case 'latest':
        orderBy = 'approved_at';
        ascending = false;
        break;
      case 'oldest':
        orderBy = 'approved_at';
        ascending = true;
        break;
      case 'most_liked':
        // จะต้อง sort ใน application layer เพราะ like_count อยู่ใน view
        orderBy = 'approved_at';
        ascending = false;
        break;
      case 'most_commented':
        // จะต้อง sort ใน application layer
        orderBy = 'approved_at';
        ascending = false;
        break;
      default:
        orderBy = 'approved_at';
        ascending = false;
    }

    let images = await db.getImages({
      status: 'approved',
      orderBy,
      ascending
    });

    // Sort ตาม like_count หรือ comment_count
    if (sort === 'most_liked') {
      images.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
    } else if (sort === 'most_commented') {
      images.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
    }

    // Pagination
    const paginatedImages = images.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    res.json({
      success: true,
      images: paginatedImages,
      total: images.length,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get gallery images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gallery images',
      error: error.message
    });
  }
};

// ดึงข้อมูลรูปภาพเดี่ยว
export const getImageById = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // ดึงคอมเมนต์
    const comments = await db.getComments(imageId);

    // ตรวจสอบว่า user ไลค์แล้วหรือยัง
    const sessionId = generateSessionId(req);
    const hasLiked = await db.hasUserLiked(imageId, sessionId);

    res.json({
      success: true,
      image: {
        ...image,
        comments,
        hasLiked
      }
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get image',
      error: error.message
    });
  }
};

// ไลค์รูปภาพ
export const likeImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const sessionId = generateSessionId(req);
    const ipAddress = getClientIp(req);

    // ตรวจสอบว่าไลค์แล้วหรือยัง
    const hasLiked = await db.hasUserLiked(imageId, sessionId);

    if (hasLiked) {
      // ถ้าไลค์แล้ว ให้ยกเลิกไลค์
      await db.removeLike(imageId, sessionId);

      const likeCount = await db.getLikeCount(imageId);

      // ส่ง event ผ่าน Socket.io
      if (req.app.get('io')) {
        req.app.get('io').emit('image:unliked', {
          imageId,
          likeCount
        });
      }

      return res.json({
        success: true,
        message: 'Like removed',
        liked: false,
        likeCount
      });
    }

    // เพิ่มไลค์
    await db.addLike(imageId, sessionId, ipAddress);

    const likeCount = await db.getLikeCount(imageId);

    // ส่ง event ผ่าน Socket.io
    if (req.app.get('io')) {
      req.app.get('io').emit('image:liked', {
        imageId,
        likeCount
      });
    }

    res.json({
      success: true,
      message: 'Image liked',
      liked: true,
      likeCount
    });
  } catch (error) {
    console.error('Like image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like image',
      error: error.message
    });
  }
};

// คอมเมนต์รูปภาพ
export const commentImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment too long (max 500 characters)'
      });
    }

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const sessionId = generateSessionId(req);
    const ipAddress = getClientIp(req);

    const newComment = await db.addComment(
      imageId,
      sessionId,
      comment.trim(),
      ipAddress
    );

    // ส่ง event ผ่าน Socket.io
    if (req.app.get('io')) {
      req.app.get('io').emit('image:commented', {
        imageId,
        comment: newComment
      });
    }

    res.json({
      success: true,
      message: 'Comment added',
      comment: newComment
    });
  } catch (error) {
    console.error('Comment image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
};

// ดึงคอมเมนต์
export const getComments = async (req, res) => {
  try {
    const { imageId } = req.params;

    const comments = await db.getComments(imageId);

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comments',
      error: error.message
    });
  }
};

export default {
  getDisplayImages,
  getGalleryImages,
  getImageById,
  likeImage,
  commentImage,
  getComments
};
