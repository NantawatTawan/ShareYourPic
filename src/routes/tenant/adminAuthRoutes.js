import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../../config/database.js';
import { loadTenant } from '../../middleware/tenant.js';
import { generateToken } from '../../middleware/auth.js';

const router = express.Router();

// POST /:tenantSlug/admin/login - Admin login
router.post('/:tenantSlug/admin/login', loadTenant, async (req, res) => {
  try {
    const tenant = req.tenant;
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

    // ตรวจสอบว่า admin นี้เป็นของร้านนี้หรือเป็น super admin
    if (!admin.is_super_admin && admin.tenant_id !== tenant.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this tenant'
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
      username: admin.username,
      tenant_id: admin.tenant_id,
      is_super_admin: admin.is_super_admin,
      role: admin.role
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        tenant_id: admin.tenant_id,
        is_super_admin: admin.is_super_admin,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

export default router;
