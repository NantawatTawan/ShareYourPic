import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware สำหรับตรวจสอบ JWT token สำหรับ Admin
export const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET);

    // ดึงข้อมูล admin เต็มจาก database (รวม tenant_id, is_super_admin)
    const { supabase } = await import('../config/database.js');
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, username, tenant_id, role, is_super_admin')
      .eq('id', decoded.id)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// สร้าง JWT token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h'
  });
};

export default {
  authenticateAdmin,
  generateToken
};
