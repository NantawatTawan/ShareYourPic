import { jest } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import signupRoutes from '../src/routes/signupRoutes.js';
import { supabase } from '../src/config/database.js';

// Mock Stripe
jest.mock('../src/config/stripe.js', () => ({
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test123',
        email: 'test@example.com',
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_test',
        customer: 'cus_test123',
        amount: 29900,
        currency: 'thb',
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        customer: 'cus_test123',
        amount: 29900,
        currency: 'thb',
        metadata: {
          plan_key: 'starter_monthly',
          shop_name: 'Test Shop',
          shop_slug: 'test-shop',
          owner_email: 'test@example.com',
          owner_phone: '0812345678',
        },
      }),
    },
  },
}));

describe('Signup API Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', signupRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/check-slug/:slug', () => {
    it('should return available=true for unused slug', async () => {
      // Mock Supabase to return no tenant
      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }));

      const response = await request(app).get('/api/check-slug/my-unique-event');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ available: true });
    });

    it('should return available=false for existing slug', async () => {
      // Mock Supabase to return existing tenant
      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'tenant-123', slug: 'existing-event' },
          error: null,
        }),
      }));

      const response = await request(app).get('/api/check-slug/existing-event');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ available: false });
    });

    it('should return available=false for invalid slug format', async () => {
      const response = await request(app).get('/api/check-slug/Invalid_Slug!');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ available: false, reason: 'invalid_format' });
    });

    it('should return available=false for too short slug', async () => {
      const response = await request(app).get('/api/check-slug/ab');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ available: false, reason: 'too_short' });
    });
  });

  describe('POST /api/signup/trial', () => {
    it('should create trial account successfully', async () => {
      const mockTenant = { id: 'tenant-123', slug: 'test-event', name: 'Test Event' };
      const mockPlan = { id: 'plan-123', plan_key: 'trial' };
      const mockSubscription = { id: 'sub-123' };
      const mockAdmin = { id: 'admin-123' };

      // Mock database calls
      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }));

      jest.spyOn(supabase.from('subscription_plans'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
      }));

      jest.spyOn(supabase.from('tenants'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
      }));

      jest.spyOn(supabase.from('subscriptions'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      }));

      jest.spyOn(supabase.from('admins'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null }),
      }));

      const response = await request(app)
        .post('/api/signup/trial')
        .send({
          shopName: 'Test Event',
          shopSlug: 'test-event',
          ownerEmail: 'test@example.com',
          ownerPhone: '0812345678',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        tenant: {
          id: 'tenant-123',
          slug: 'test-event',
          name: 'Test Event',
        },
      });
      expect(response.body.credentials).toHaveProperty('username');
      expect(response.body.credentials).toHaveProperty('password');
      expect(response.body.credentials).toHaveProperty('loginUrl');
    });

    it('should return error for missing fields', async () => {
      const response = await request(app)
        .post('/api/signup/trial')
        .send({
          shopName: 'Test Event',
          // Missing shopSlug, ownerEmail, ownerPhone
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return error for existing slug', async () => {
      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'tenant-123' },
          error: null,
        }),
      }));

      const response = await request(app)
        .post('/api/signup/trial')
        .send({
          shopName: 'Test Event',
          shopSlug: 'existing-event',
          ownerEmail: 'test@example.com',
          ownerPhone: '0812345678',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Slug already taken');
    });
  });

  describe('POST /api/signup/create-payment', () => {
    it('should create payment intent for paid plan', async () => {
      const mockPlan = {
        id: 'plan-123',
        plan_key: 'starter_monthly',
        name: 'Starter (รายเดือน)',
        price_amount: 29900,
        price_currency: 'thb',
      };

      jest.spyOn(supabase.from('subscription_plans'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
      }));

      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }));

      const { stripe } = require('../src/config/stripe.js');

      const response = await request(app)
        .post('/api/signup/create-payment')
        .send({
          planKey: 'starter_monthly',
          shopName: 'Test Shop',
          shopSlug: 'test-shop',
          ownerEmail: 'test@example.com',
          ownerPhone: '0812345678',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        clientSecret: 'pi_test123_secret_test',
        paymentIntentId: 'pi_test123',
        customerId: 'cus_test123',
      });

      expect(stripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test Shop',
          phone: '0812345678',
        })
      );

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 29900,
          currency: 'thb',
          customer: 'cus_test123',
        })
      );
    });

    it('should return error for free plan', async () => {
      const mockPlan = {
        id: 'plan-123',
        plan_key: 'trial',
        price_amount: 0,
      };

      jest.spyOn(supabase.from('subscription_plans'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
      }));

      const response = await request(app)
        .post('/api/signup/create-payment')
        .send({
          planKey: 'trial',
          shopName: 'Test Shop',
          shopSlug: 'test-shop',
          ownerEmail: 'test@example.com',
          ownerPhone: '0812345678',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'This plan does not require payment');
    });
  });

  describe('POST /api/signup/complete', () => {
    it('should complete signup after successful payment', async () => {
      const mockPlan = { id: 'plan-123', plan_key: 'starter_monthly', billing_type: 'subscription', billing_interval: 'month' };
      const mockTenant = { id: 'tenant-123', slug: 'test-shop', name: 'Test Shop' };
      const mockSubscription = { id: 'sub-123' };
      const mockAdmin = { id: 'admin-123' };

      jest.spyOn(supabase.from('tenants'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }));

      jest.spyOn(supabase.from('subscription_plans'), 'select').mockImplementationOnce(() => ({
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockPlan, error: null }),
      }));

      jest.spyOn(supabase.from('tenants'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTenant, error: null }),
      }));

      jest.spyOn(supabase.from('subscriptions'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockSubscription, error: null }),
      }));

      jest.spyOn(supabase.from('admins'), 'insert').mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null }),
      }));

      jest.spyOn(supabase.from('billing_history'), 'insert').mockImplementationOnce(() =>
        Promise.resolve({ data: null, error: null })
      );

      const response = await request(app)
        .post('/api/signup/complete')
        .send({
          paymentIntentId: 'pi_test123',
          shopSlug: 'test-shop',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        tenant: {
          id: 'tenant-123',
          slug: 'test-shop',
        },
      });
      expect(response.body.credentials).toHaveProperty('username');
      expect(response.body.credentials).toHaveProperty('password');
    });

    it('should return error if payment not completed', async () => {
      const { stripe } = require('../src/config/stripe.js');
      stripe.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_test123',
        status: 'pending', // Not succeeded
      });

      const response = await request(app)
        .post('/api/signup/complete')
        .send({
          paymentIntentId: 'pi_test123',
          shopSlug: 'test-shop',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Payment not completed');
    });
  });
});
