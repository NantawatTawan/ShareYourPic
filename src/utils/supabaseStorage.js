import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const STORAGE_BUCKET = 'shareyourpic-images'; // ชื่อ bucket ใน Supabase Storage

// สร้าง Supabase client สำหรับ storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ตรวจสอบไฟล์
export const validateFile = (file) => {
  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed');
  }

  return true;
};

// บันทึกไฟล์ไปยัง Supabase Storage
export const saveImage = async (file) => {
  try {
    const fileExtension = path.extname(file.name);
    const filename = `${uuidv4()}${fileExtension}`;
    const thumbnailFilename = `thumb_${filename}`;

    // Process image
    const imageBuffer = file.data;
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Resize image ถ้าใหญ่เกินไป (max 2000px)
    let processedImage = image;
    if (metadata.width > 2000 || metadata.height > 2000) {
      processedImage = image.resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to JPEG and optimize
    const fullImageBuffer = await processedImage
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    // Create thumbnail (300px)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Upload to Supabase Storage
    // Full image
    const { data: fullImageData, error: fullImageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`images/${filename}`, fullImageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (fullImageError) {
      throw new Error(`Failed to upload image: ${fullImageError.message}`);
    }

    // Thumbnail
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`thumbnails/${thumbnailFilename}`, thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (thumbnailError) {
      throw new Error(`Failed to upload thumbnail: ${thumbnailError.message}`);
    }

    // Get public URLs
    const { data: { publicUrl: fileUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`images/${filename}`);

    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`thumbnails/${thumbnailFilename}`);

    return {
      filename,
      originalFilename: file.name,
      fileUrl,
      thumbnailUrl,
      fileSize: fullImageBuffer.length,
      mimeType: 'image/jpeg',
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('Save image error:', error);
    throw error;
  }
};

// ลบรูปภาพจาก Supabase Storage
export const deleteImage = async (filename, thumbnailFilename) => {
  try {
    // Delete full image
    const { error: fullImageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([`images/${filename}`]);

    if (fullImageError) {
      console.error('Error deleting image:', fullImageError);
    }

    // Delete thumbnail
    const { error: thumbnailError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([`thumbnails/${thumbnailFilename}`]);

    if (thumbnailError) {
      console.error('Error deleting thumbnail:', thumbnailError);
    }

    return true;
  } catch (error) {
    console.error('Delete image error:', error);
    throw error;
  }
};

export default {
  validateFile,
  saveImage,
  deleteImage
};
