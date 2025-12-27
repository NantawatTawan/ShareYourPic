import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// สร้าง directories ถ้ายังไม่มี
export const ensureUploadDirs = async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directories:', error);
    throw error;
  }
};

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

// บันทึกไฟล์และสร้าง thumbnail
export const saveImage = async (file) => {
  try {
    await ensureUploadDirs();

    const fileExtension = path.extname(file.name);
    const filename = `${uuidv4()}${fileExtension}`;
    const thumbnailFilename = `thumb_${filename}`;

    const filePath = path.join(UPLOAD_DIR, filename);
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

    // บันทึกรูปต้นฉบับ (optimize ด้วย sharp)
    const imageBuffer = file.data;
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Resize ถ้ารูปใหญ่เกินไป (max 2000px)
    let processedImage = image;
    if (metadata.width > 2000) {
      processedImage = image.resize(2000, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    await processedImage
      .jpeg({ quality: 85, progressive: true })
      .toFile(filePath);

    // สร้าง thumbnail (300px wide)
    await sharp(imageBuffer)
      .resize(300, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // ดึง metadata ของรูปที่บันทึกแล้ว
    const savedImageMetadata = await sharp(filePath).metadata();

    return {
      filename,
      thumbnailFilename,
      filePath,
      thumbnailPath,
      fileUrl: `/uploads/${filename}`,
      thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
      originalFilename: file.name,
      mimeType: file.mimetype,
      fileSize: file.size,
      width: savedImageMetadata.width,
      height: savedImageMetadata.height
    };
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

// ลบไฟล์
export const deleteImage = async (filename, thumbnailFilename) => {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(thumbnailPath).catch(() => {});

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

export default {
  ensureUploadDirs,
  validateFile,
  saveImage,
  deleteImage
};
