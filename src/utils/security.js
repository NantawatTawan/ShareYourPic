import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Sanitize user input to prevent XSS attacks
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  // Remove any HTML tags and scripts
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: []
  }).trim();
};

/**
 * Validate and sanitize email
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return null;

  const trimmed = email.trim().toLowerCase();
  return validator.isEmail(trimmed) ? trimmed : null;
};

/**
 * Validate UUID
 */
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  return validator.isUUID(uuid);
};

/**
 * Validate and sanitize slug (tenant slug, etc.)
 */
export const sanitizeSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return null;

  // Slug should only contain lowercase letters, numbers, and hyphens
  const cleaned = slug.trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(cleaned) ? cleaned : null;
};

/**
 * Validate and sanitize integer
 */
export const sanitizeInteger = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};

/**
 * Validate sort parameter
 */
export const validateSortParam = (sort, allowedValues = ['latest', 'oldest', 'most_liked', 'most_commented']) => {
  return allowedValues.includes(sort) ? sort : allowedValues[0];
};

/**
 * Sanitize caption/comment text
 */
export const sanitizeText = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') return '';

  // Remove HTML, trim, and limit length
  const cleaned = sanitizeInput(text);
  return cleaned.substring(0, maxLength);
};

/**
 * Validate file type
 */
export const isValidImageType = (mimetype) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  return allowedTypes.includes(mimetype);
};

/**
 * Validate file size (in bytes)
 */
export const isValidFileSize = (size, maxSize = 10 * 1024 * 1024) => { // 10MB default
  return size > 0 && size <= maxSize;
};

/**
 * Rate limiting helper - check if action is allowed
 */
export const checkRateLimit = (sessionId, action, limits, cache) => {
  const key = `${sessionId}:${action}`;
  const now = Date.now();
  const record = cache.get(key);

  if (!record) {
    cache.set(key, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  const timeWindow = limits.windowMs || 60000; // 1 minute default
  const maxRequests = limits.max || 10;

  if (now - record.firstRequest > timeWindow) {
    // Reset window
    cache.set(key, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const resetIn = timeWindow - (now - record.firstRequest);
    return {
      allowed: false,
      resetIn: Math.ceil(resetIn / 1000) // seconds
    };
  }

  record.count++;
  cache.set(key, record);
  return { allowed: true };
};

export default {
  sanitizeInput,
  sanitizeEmail,
  isValidUUID,
  sanitizeSlug,
  sanitizeInteger,
  validateSortParam,
  sanitizeText,
  isValidImageType,
  isValidFileSize,
  checkRateLimit
};
