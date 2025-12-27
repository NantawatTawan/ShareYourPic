import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
// เลือกใช้ storage แบบไหนตาม environment
import * as localStorage from '../utils/fileHandler.js';
import * as supabaseStorage from '../utils/supabaseStorage.js';

const USE_SUPABASE_STORAGE = process.env.USE_SUPABASE_STORAGE === 'true' || process.env.NODE_ENV === 'production';
const storage = USE_SUPABASE_STORAGE ? supabaseStorage : localStorage;
const { deleteImage } = storage;

// Admin login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // ดึงข้อมูล admin
    const admin = await db.getAdminByUsername(username);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // ตรวจสอบรหัสผ่าน
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // สร้าง JWT token
    const token = generateToken({
      id: admin.id,
      username: admin.username
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// ดึงรูปภาพที่รอการตรวจสอบ
export const getPendingImages = async (req, res) => {
  try {
    const images = await db.getImages({
      status: 'pending',
      orderBy: 'uploaded_at',
      ascending: true
    });

    res.json({
      success: true,
      images
    });
  } catch (error) {
    console.error('Get pending images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending images',
      error: error.message
    });
  }
};

// ดึงรูปภาพทั้งหมด (สำหรับ admin)
export const getAllImages = async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;

    const filters = {
      orderBy: 'uploaded_at',
      ascending: false
    };

    if (status) {
      filters.status = status;
    }

    const images = await db.getImages(filters);

    res.json({
      success: true,
      images: images.slice(offset, offset + parseInt(limit)),
      total: images.length
    });
  } catch (error) {
    console.error('Get all images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get images',
      error: error.message
    });
  }
};

// อนุมัติรูปภาพ
export const approveImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const adminId = req.admin.id;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    if (image.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Image already processed'
      });
    }

    // อนุมัติรูปภาพ (expires_at จะถูกตั้งค่าอัตโนมัติโดย trigger ในฐานข้อมูล)
    const updatedImage = await db.updateImage(imageId, {
      status: 'approved',
      approved_by: adminId
    });

    // ส่ง event ผ่าน Socket.io (จะทำใน server.js)
    if (req.app.get('io')) {
      req.app.get('io').emit('image:approved', updatedImage);
    }

    res.json({
      success: true,
      message: 'Image approved successfully',
      image: updatedImage
    });
  } catch (error) {
    console.error('Approve image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve image',
      error: error.message
    });
  }
};

// ปฏิเสธรูปภาพ
export const rejectImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { reason } = req.body;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    if (image.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Image already processed'
      });
    }

    // ปฏิเสธรูปภาพ
    const updatedImage = await db.updateImage(imageId, {
      status: 'rejected',
      rejection_reason: reason || 'No reason provided'
    });

    // ลบไฟล์รูปภาพ (optional - อาจจะเก็บไว้ก็ได้)
    // await deleteImage(image.filename, `thumb_${image.filename}`);

    res.json({
      success: true,
      message: 'Image rejected successfully',
      image: updatedImage
    });
  } catch (error) {
    console.error('Reject image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject image',
      error: error.message
    });
  }
};

// ลบรูปภาพ
export const deleteImageById = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await db.getImageById(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // ลบไฟล์
    await deleteImage(image.filename, `thumb_${image.filename}`);

    // ลบจากฐานข้อมูล
    await db.deleteImage(imageId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
};

// สถิติ
export const getStats = async (req, res) => {
  try {
    const allImages = await db.getImages({});

    const stats = {
      total: allImages.length,
      pending: allImages.filter(img => img.status === 'pending').length,
      approved: allImages.filter(img => img.status === 'approved').length,
      rejected: allImages.filter(img => img.status === 'rejected').length,
      totalLikes: allImages.reduce((sum, img) => sum + (img.like_count || 0), 0),
      totalComments: allImages.reduce((sum, img) => sum + (img.comment_count || 0), 0)
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
};

// ลบ comment
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    // ลบ comment
    const { error } = await db.supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
};

export default {
  login,
  getPendingImages,
  getAllImages,
  approveImage,
  rejectImage,
  deleteImageById,
  getStats,
  deleteComment
};
