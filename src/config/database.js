import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function สำหรับ query
export const db = {
  supabase, // เพิ่ม supabase client เข้าไปใน db object

  // Images
  async getImages(filters = {}) {
    let query = supabase.from('images_with_stats').select('*');

    // Filter by tenant_id (สำคัญมาก!)
    if (filters.tenant_id) {
      query = query.eq('tenant_id', filters.tenant_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.notExpired) {
      query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    if (filters.orderBy) {
      query = query.order(filters.orderBy, { ascending: filters.ascending || false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getImageById(id, tenant_id = null) {
    let query = supabase
      .from('images_with_stats')
      .select('*')
      .eq('id', id);

    // Filter by tenant_id ถ้ามี
    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }

    const { data, error } = await query.single();

    if (error) throw error;
    return data;
  },

  async createImage(imageData) {
    const { data, error } = await supabase
      .from('images')
      .insert(imageData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateImage(id, updates) {
    const { data, error } = await supabase
      .from('images')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteImage(id) {
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Payments
  async createPayment(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updatePayment(id, updates) {
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPaymentByStripeId(stripePaymentIntentId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .single();

    if (error) throw error;
    return data;
  },

  // Likes
  async addLike(imageId, sessionId, tenant_id, ipAddress = null) {
    const { data, error } = await supabase
      .from('likes')
      .insert({
        image_id: imageId,
        session_id: sessionId,
        tenant_id: tenant_id,
        ip_address: ipAddress
      })
      .select()
      .single();

    if (error) {
      // ถ้าไลค์ซ้ำ (UNIQUE constraint violation)
      if (error.code === '23505') {
        throw new Error('Already liked');
      }
      throw error;
    }
    return data;
  },

  async removeLike(imageId, sessionId, tenant_id) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('image_id', imageId)
      .eq('session_id', sessionId)
      .eq('tenant_id', tenant_id);

    if (error) throw error;
    return true;
  },

  async getLikeCount(imageId) {
    const { count, error } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('image_id', imageId);

    if (error) throw error;
    return count;
  },

  async hasUserLiked(imageId, sessionId) {
    const { data, error } = await supabase
      .from('likes')
      .select('id')
      .eq('image_id', imageId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  // Comments
  async getComments(imageId, tenant_id = null) {
    let query = supabase
      .from('comments')
      .select('*')
      .eq('image_id', imageId)
      .eq('is_hidden', false);

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async addComment(imageId, sessionId, tenant_id, commentText, ipAddress = null) {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        image_id: imageId,
        session_id: sessionId,
        tenant_id: tenant_id,
        comment_text: commentText,
        ip_address: ipAddress
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async hideComment(commentId) {
    const { data, error } = await supabase
      .from('comments')
      .update({ is_hidden: true })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Admins
  async getAdminByUsername(username) {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createAdmin(username, passwordHash, tenant_id = null, is_super_admin = false) {
    const { data, error } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        tenant_id,
        is_super_admin,
        role: is_super_admin ? 'super_admin' : 'admin'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Tenants
  async getTenantBySlug(slug) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getAllTenants(filters = {}) {
    let query = supabase.from('tenants').select('*');

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.is_public !== undefined) {
      query = query.eq('is_public', filters.is_public);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createTenant(tenantData) {
    const { data, error } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTenant(id, updates) {
    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTenant(id) {
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};

export default db;
