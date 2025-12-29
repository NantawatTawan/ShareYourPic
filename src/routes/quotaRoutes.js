import express from 'express';
import { getQuotaUsage } from '../middleware/quotaCheck.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/quota/:tenantId
 * Get quota usage for a tenant
 * SECURITY: Requires authentication, admin can only view their own tenant's quota
 */
router.get('/:tenantId', authenticateAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const admin = req.admin;

    // SECURITY: Only allow super admin or tenant's own admin to view quota
    if (!admin.is_super_admin && admin.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this quota'
      });
    }

    const quota = await getQuotaUsage(tenantId);

    res.json({
      success: true,
      quota,
    });
  } catch (error) {
    console.error('Error getting quota:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota usage'
    });
  }
});

export default router;
