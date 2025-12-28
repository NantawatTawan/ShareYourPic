import db from '../config/database.js';
import { generateSessionId, getClientIp } from '../utils/session.js';
import {
  ImageDTO,
  GalleryImageDTO,
  ImageDetailDTO,
  LikeResponseDTO,
  PaginatedResponseDTO
} from '../dto/imageDTO.js';
import {
  isValidUUID,
  sanitizeInteger,
  validateSortParam,
  sanitizeText
} from '../utils/security.js';

// ดึงรูปภาพสำหรับหน้า Display (โปรเจคเตอร์) - รูปที่ approved และยังไม่หมดอายุ
export const getDisplayImages = async (req, res) => {
  try {
    const images = await db.getImages({
      status: 'approved',
      notExpired: true,
      orderBy: 'approved_at',
      ascending: false
    });

    const imagesDTOs = ImageDTO.fromDatabaseArray(images);

    res.json({
      success: true,
      data: imagesDTOs
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
    // Sanitize and validate query parameters
    const sort = validateSortParam(req.query.sort, ['latest', 'oldest', 'most_liked', 'most_commented']);
    const limit = sanitizeInteger(req.query.limit, 1, 100); // Max 100 per page
    const offset = sanitizeInteger(req.query.offset, 0);

    // Fetch all approved images
    let images = await db.getImages({
      status: 'approved',
      orderBy: 'approved_at',
      ascending: false
    });

    // Sort based on user selection
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
        images.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
    }

    const totalImages = images.length;

    // Apply pagination
    const paginatedImages = images.slice(offset, offset + limit);

    // เช็คว่า user ไลค์รูปไหนไปแล้วบ้าง
    const sessionId = generateSessionId(req);
    const imagesWithLikeStatus = await Promise.all(
      paginatedImages.map(async (image) => {
        const hasLiked = await db.hasUserLiked(image.id, sessionId);
        return new GalleryImageDTO(image, hasLiked);
      })
    );

    const response = new PaginatedResponseDTO(
      imagesWithLikeStatus,
      totalImages,
      offset,
      limit
    );

    res.json(response);
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

// ไลค์รูปภาพ (with transaction for concurrency safety)
export const likeImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    // Validate UUID
    if (!isValidUUID(imageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID format'
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

    // ตรวจสอบว่าไลค์แล้วหรือยัง
    const hasLiked = await db.hasUserLiked(imageId, sessionId);

    if (hasLiked) {
      // ถ้าไลค์แล้ว ไม่ต้องทำอะไร (ป้องกันการกด unlike)
      const likeCount = await db.getLikeCount(imageId);

      const response = new LikeResponseDTO(imageId, true, likeCount);
      return res.json(response);
    }

    // เพิ่มไลค์ (เฉพาะคนที่ยังไม่เคยกด like)
    await db.addLike(imageId, sessionId, ipAddress);

    const likeCount = await db.getLikeCount(imageId);

    // ส่ง event ผ่าน Socket.io
    if (req.app.get('io')) {
      req.app.get('io').emit('image:liked', {
        imageId,
        likeCount
      });
    }

    const response = new LikeResponseDTO(imageId, true, likeCount);
    res.json(response);
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

    // Validate UUID
    if (!isValidUUID(imageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image ID format'
      });
    }

    // Sanitize comment text (remove HTML, XSS attempts)
    const sanitizedComment = sanitizeText(comment, 500);

    if (!sanitizedComment || sanitizedComment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
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
      sanitizedComment,
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
