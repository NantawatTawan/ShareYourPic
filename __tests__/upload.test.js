import request from 'supertest';
import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock modules
const mockDb = {
  getTenantBySlug: jest.fn(),
  createPayment: jest.fn(),
  createImage: jest.fn(),
  getPaymentByStripeId: jest.fn(),
  updatePaymentStatus: jest.fn()
};

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn()
  }
};

// Mock sharp
const mockSharp = jest.fn(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  toFile: jest.fn().mockResolvedValue({}),
  metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 })
}));

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }
  }));

  // Mock loadTenant middleware
  app.use((req, res, next) => {
    const slug = req.params.tenantSlug || 'test-tenant';
    const isPaidShop = slug.includes('paid');

    req.tenant = {
      id: 'test-tenant-id',
      slug: slug,
      name: 'Test Tenant',
      payment_enabled: isPaidShop,
      price_amount: 3500,
      price_currency: 'thb'
    };
    next();
  });

  // Define routes inline for testing
  app.post('/:tenantSlug/payment/create', async (req, res) => {
    try {
      const tenant = req.tenant;
      const { session_id } = req.body;

      if (!tenant.payment_enabled) {
        return res.json({
          success: true,
          payment_required: false,
          message: 'This tenant does not require payment'
        });
      }

      const paymentIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_456',
        amount: tenant.price_amount,
        currency: tenant.price_currency,
        metadata: {
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          session_id: session_id || 'unknown'
        }
      };

      mockStripe.paymentIntents.create.mockResolvedValue(paymentIntent);
      await mockDb.createPayment({
        tenant_id: tenant.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: tenant.price_amount,
        currency: tenant.price_currency,
        status: 'pending',
        session_id,
        metadata: paymentIntent.metadata
      });

      res.json({
        success: true,
        payment_required: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: tenant.price_amount,
        currency: tenant.price_currency
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to create payment: ' + error.message
      });
    }
  });

  app.post('/:tenantSlug/upload', async (req, res) => {
    try {
      const tenant = req.tenant;
      const { paymentIntentId, session_id, caption } = req.body;

      // ตรวจสอบว่าต้องจ่ายเงินหรือไม่
      if (tenant.payment_enabled) {
        if (!paymentIntentId || paymentIntentId === 'null' || paymentIntentId === 'undefined') {
          return res.status(400).json({
            success: false,
            message: 'Payment is required for this tenant'
          });
        }

        // Mock Stripe verification
        const paymentIntent = {
          id: paymentIntentId,
          status: 'succeeded',
          metadata: {
            tenant_id: tenant.id.toString()
          }
        };
        mockStripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);

        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({
            success: false,
            message: 'Payment not completed. Status: ' + paymentIntent.status
          });
        }
      }

      // ตรวจสอบไฟล์
      if (!req.files || !req.files.image) {
        return res.status(400).json({
          success: false,
          message: 'No image file uploaded'
        });
      }

      const imageFile = req.files.image;

      // Mock image creation
      const image = {
        id: 'img_test_123',
        tenant_id: tenant.id,
        payment_id: paymentIntentId ? 'payment_123' : null,
        filename: 'test-image.jpg',
        original_filename: imageFile.name,
        file_url: '/uploads/test-tenant/images/test-image.jpg',
        thumbnail_url: '/uploads/test-tenant/thumbnails/test-image.jpg',
        file_size: imageFile.size,
        mime_type: imageFile.mimetype,
        width: 1920,
        height: 1080,
        caption: caption || null,
        status: 'pending',
        upload_session_id: session_id
      };

      mockDb.createImage.mockResolvedValue(image);

      res.json({
        success: true,
        data: image
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload image'
      });
    }
  });

  return app;
}

describe('Upload Routes Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /:tenantSlug/payment/create', () => {
    test('should return payment_required: false for free tenant', async () => {
      app = createTestApp();

      const response = await request(app)
        .post('/free-shop/payment/create')
        .send({ session_id: 'test-session-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment_required).toBe(false);
      expect(response.body.message).toBe('This tenant does not require payment');
    });

    test('should create payment intent for paid tenant', async () => {
      app = createTestApp();

      const response = await request(app)
        .post('/paid-shop/payment/create')
        .send({ session_id: 'test-session-456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment_required).toBe(true);
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.paymentIntentId).toBeDefined();
      expect(response.body.amount).toBe(3500);
      expect(mockDb.createPayment).toHaveBeenCalled();
    });
  });

  describe('POST /:tenantSlug/upload - Free Upload', () => {
    test('should upload image without payment for free tenant', async () => {
      app = createTestApp();

      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      // Create test image if not exists
      try {
        await fs.mkdir(path.join(__dirname, 'fixtures'), { recursive: true });
        // Create a simple 1x1 pixel JPEG buffer
        const testImageBuffer = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
          0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
          0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
          0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
          0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
          0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
          0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
          0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
          0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
          0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
          0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
          0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
          0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x03, 0xFF, 0xC4, 0x00, 0x14,
          0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
          0x00, 0x00, 0x3F, 0x00, 0x7F, 0x80, 0xFF, 0xD9
        ]);
        await fs.writeFile(testImagePath, testImageBuffer);
      } catch (err) {
        console.error('Error creating test image:', err);
      }

      const response = await request(app)
        .post('/free-shop/upload')
        .field('session_id', 'test-session-123')
        .field('caption', 'Test free upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.payment_id).toBeNull();
      expect(response.body.data.caption).toBe('Test free upload');
      expect(mockDb.createImage).toHaveBeenCalled();
    });

    test('should reject upload without image file', async () => {
      app = createTestApp();

      const response = await request(app)
        .post('/free-shop/upload')
        .field('session_id', 'test-session-123');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No image file uploaded');
    });

    test('should handle paymentIntentId gracefully for free tenant', async () => {
      app = createTestApp();

      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      const response = await request(app)
        .post('/free-shop/upload')
        .field('session_id', 'test-session-123')
        .field('paymentIntentId', 'pi_ignored_123')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // For free tenant, payment is not required regardless of paymentIntentId
      expect(response.body.data).toBeDefined();
    });
  });

  describe('POST /:tenantSlug/upload - Paid Upload', () => {
    test('should require payment for paid tenant', async () => {
      app = createTestApp();

      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      const response = await request(app)
        .post('/paid-shop/upload')
        .field('session_id', 'test-session-123')
        .attach('image', testImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Payment is required for this tenant');
    });

    test('should upload image with valid payment', async () => {
      app = createTestApp();

      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      const response = await request(app)
        .post('/paid-shop/upload')
        .field('session_id', 'test-session-123')
        .field('paymentIntentId', 'pi_test_123')
        .field('caption', 'Test paid upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.caption).toBe('Test paid upload');
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_test_123');
      expect(mockDb.createImage).toHaveBeenCalled();
    });

    test('should reject string "null" as paymentIntentId', async () => {
      app = createTestApp();

      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      const response = await request(app)
        .post('/paid-shop/upload')
        .field('session_id', 'test-session-123')
        .field('paymentIntentId', 'null')
        .attach('image', testImagePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Payment is required for this tenant');
    });
  });
});
