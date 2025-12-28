import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Verify admin token and check tenant access
 */
export const verifyAdminAccess = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Get tenant from request params
    const requestedTenantSlug = req.params.tenantSlug || req.tenant?.slug;

    // Verify admin belongs to this tenant
    const admin = await db.getAdminByEmail(decoded.email);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Check if admin belongs to the requested tenant
    if (admin.tenant_id !== req.tenant?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access this tenant'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Verify super admin token
 */
export const verifySuperAdminAccess = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify super admin
    const superAdmin = await db.getSuperAdminByEmail(decoded.email);

    if (!superAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    console.error('Super admin verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Rate limiting middleware
 */
const requestCache = new Map();

export const rateLimitMiddleware = (limits = { windowMs: 60000, max: 100 }) => {
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const key = `${identifier}:${req.path}`;
    const now = Date.now();
    const record = requestCache.get(key);

    if (!record) {
      requestCache.set(key, { count: 1, firstRequest: now });
      return next();
    }

    if (now - record.firstRequest > limits.windowMs) {
      requestCache.set(key, { count: 1, firstRequest: now });
      return next();
    }

    if (record.count >= limits.max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((limits.windowMs - (now - record.firstRequest)) / 1000)
      });
    }

    record.count++;
    requestCache.set(key, record);
    next();
  };
};

// Clean up old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  for (const [key, value] of requestCache.entries()) {
    if (now - value.firstRequest > maxAge) {
      requestCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default {
  verifyAdminAccess,
  verifySuperAdminAccess,
  rateLimitMiddleware
};
