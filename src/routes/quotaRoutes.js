import express from 'express';
import { getQuotaUsage } from '../middleware/quotaCheck.js';

const router = express.Router();

/**
 * GET /api/quota/:tenantId
 * Get quota usage for a tenant
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const quota = await getQuotaUsage(tenantId);

    res.json({
      success: true,
      quota,
    });
  } catch (error) {
    console.error('Error getting quota:', error);
    res.status(500).json({ error: 'Failed to get quota usage' });
  }
});

export default router;
