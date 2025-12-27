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

  async getImageById(id) {
    const { data, error } = await supabase
      .from('images_with_stats')
      .select('*')
      .eq('id', id)
      .single();

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
  async addLike(imageId, sessionId, ipAddress = null) {
    const { data, error } = await supabase
      .from('likes')
      .insert({
        image_id: imageId,
        session_id: sessionId,
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

  async removeLike(imageId, sessionId) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('image_id', imageId)
      .eq('session_id', sessionId);

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
  async getComments(imageId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('image_id', imageId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async addComment(imageId, sessionId, commentText, ipAddress = null) {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        image_id: imageId,
        session_id: sessionId,
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

  async createAdmin(username, passwordHash) {
    const { data, error } = await supabase
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export default db;
