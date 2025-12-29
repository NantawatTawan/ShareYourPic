/**
 * Pricing Configuration
 * ตั้งค่าราคาและแพ็กเกจทั้งหมด
 *
 * หมายเหตุ:
 * - ราคาเป็น satang (100 satang = 1 THB)
 * - max = -1 หมายถึง unlimited
 */

export const PRICING_PLANS = {
  // =============================================
  // FREE TRIAL
  // =============================================
  trial: {
    key: 'trial',
    name: 'ทดลองใช้ฟรี',
    description: 'ทดลองใช้งาน 3 วัน ฟรี ไม่ต้องใส่บัตรเครดิต',
    price: 0,
    currency: 'thb',
    billing_type: 'one_time',
    duration_days: 3,
    features: {
      max_tenants: 1,
      max_uploads: 50,
      storage_gb: 1,
      retention_days: 3,
      watermark: true,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null, // ไม่ต้องใช้ Stripe
    stripe_price_id: null,
    is_active: true,
    sort_order: 10,
  },

  // =============================================
  // PAY-AS-YOU-GO (ONE-TIME PAYMENTS)
  // =============================================
  oneday: {
    key: 'oneday',
    name: '1 วัน',
    description: 'ใช้งานได้ 1 วัน เหมาะสำหรับงานเล็กๆ',
    price: 19900, // ฿199
    currency: 'thb',
    billing_type: 'one_time',
    duration_days: 1,
    features: {
      max_tenants: 1,
      max_uploads: 200,
      storage_gb: 5,
      retention_days: 3,
      watermark: false,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null, // จะถูกสร้างใน Stripe
    stripe_price_id: null,
    is_active: true,
    sort_order: 20,
  },

  oneweek: {
    key: 'oneweek',
    name: '1 สัปดาห์',
    description: 'ใช้งานได้ 1 สัปดาห์ เหมาะสำหรับงานอีเวนต์',
    price: 49900, // ฿499
    currency: 'thb',
    billing_type: 'one_time',
    duration_days: 7,
    features: {
      max_tenants: 1,
      max_uploads: 1000,
      storage_gb: 10,
      retention_days: 7,
      watermark: false,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 30,
  },

  onemonth: {
    key: 'onemonth',
    name: '1 เดือน',
    description: 'ใช้งานได้ 1 เดือน เหมาะสำหรับงานยาว',
    price: 99900, // ฿999
    currency: 'thb',
    billing_type: 'one_time',
    duration_days: 30,
    features: {
      max_tenants: 1,
      max_uploads: 5000,
      storage_gb: 30,
      retention_days: 30,
      watermark: false,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 40,
  },

  // =============================================
  // SUBSCRIPTIONS - MONTHLY
  // =============================================
  starter_monthly: {
    key: 'starter_monthly',
    name: 'Starter',
    description: 'เหมาะสำหรับผู้ใช้งานเริ่มต้น',
    price: 29900, // ฿299/เดือน
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'month',
    features: {
      max_tenants: 1,
      max_uploads_per_month: 500,
      storage_gb: 10,
      watermark: false,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 100,
  },

  pro_monthly: {
    key: 'pro_monthly',
    name: 'Professional',
    description: 'เหมาะสำหรับช่างภาพมืออาชีพ',
    price: 89900, // ฿899/เดือน
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'month',
    features: {
      max_tenants: 3,
      max_uploads_per_month: 3000,
      storage_gb: 50,
      watermark: false,
      api_access: false,
      email_support: true,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 110,
  },

  business_monthly: {
    key: 'business_monthly',
    name: 'Business',
    description: 'เหมาะสำหรับธุรกิจอีเวนต์',
    price: 249900, // ฿2,499/เดือน
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'month',
    features: {
      max_tenants: 10,
      max_uploads_per_month: 15000,
      storage_gb: 200,
      watermark: false,
      api_access: true,
      email_support: true,
      priority_support: true,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 120,
  },

  unlimited_monthly: {
    key: 'unlimited_monthly',
    name: 'Unlimited',
    description: 'ไม่จำกัดการใช้งาน',
    price: 499900, // ฿4,999/เดือน
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'month',
    features: {
      max_tenants: -1, // unlimited
      max_uploads_per_month: -1, // unlimited
      storage_gb: 1000, // 1TB
      watermark: false,
      api_access: true,
      email_support: true,
      priority_support: true,
      dedicated_support: true,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 130,
  },

  // =============================================
  // SUBSCRIPTIONS - YEARLY (ลด 20%)
  // =============================================
  starter_yearly: {
    key: 'starter_yearly',
    name: 'Starter',
    description: 'จ่ายรายปี ประหยัดกว่า 20%',
    price: 287000, // ฿2,870/ปี (จาก ฿3,588 → ลด 20%)
    price_original: 358800, // ราคาเต็ม (299 x 12)
    discount_percent: 20,
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'year',
    features: {
      max_tenants: 1,
      max_uploads_per_month: 500,
      storage_gb: 10,
      watermark: false,
      api_access: false,
      email_support: false,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 200,
  },

  pro_yearly: {
    key: 'pro_yearly',
    name: 'Professional',
    description: 'จ่ายรายปี ประหยัดกว่า 20%',
    price: 863000, // ฿8,630/ปี
    price_original: 1078800, // ราคาเต็ม (899 x 12)
    discount_percent: 20,
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'year',
    features: {
      max_tenants: 3,
      max_uploads_per_month: 3000,
      storage_gb: 50,
      watermark: false,
      api_access: false,
      email_support: true,
      priority_support: false,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 210,
  },

  business_yearly: {
    key: 'business_yearly',
    name: 'Business',
    description: 'จ่ายรายปี ประหยัดกว่า 20%',
    price: 2399000, // ฿23,990/ปี
    price_original: 2998800, // ราคาเต็ม (2,499 x 12)
    discount_percent: 20,
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'year',
    features: {
      max_tenants: 10,
      max_uploads_per_month: 15000,
      storage_gb: 200,
      watermark: false,
      api_access: true,
      email_support: true,
      priority_support: true,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 220,
  },

  unlimited_yearly: {
    key: 'unlimited_yearly',
    name: 'Unlimited',
    description: 'จ่ายรายปี ประหยัดกว่า 20%',
    price: 4799000, // ฿47,990/ปี
    price_original: 5998800, // ราคาเต็ม (4,999 x 12)
    discount_percent: 20,
    currency: 'thb',
    billing_type: 'subscription',
    billing_interval: 'year',
    features: {
      max_tenants: -1,
      max_uploads_per_month: -1,
      storage_gb: 1000,
      watermark: false,
      api_access: true,
      email_support: true,
      priority_support: true,
      dedicated_support: true,
    },
    stripe_product_id: null,
    stripe_price_id: null,
    is_active: true,
    sort_order: 230,
  },
};

// =============================================
// QUOTA & LIMITS
// =============================================
export const QUOTA_CONFIG = {
  // Grace Period: อนุญาตให้ใช้เกิน quota ได้ 20%
  GRACE_PERIOD_MULTIPLIER: 1.2,

  // Warning Thresholds
  WARNING_THRESHOLD_PERCENT: 80, // แจ้งเตือนเมื่อใช้ครบ 80%
  CRITICAL_THRESHOLD_PERCENT: 100, // แจ้งเตือน critical เมื่อครบ 100%

  // Auto-cleanup
  EXPIRED_IMAGE_CLEANUP_DAYS: 7, // ลบรูปที่หมดอายุหลัง 7 วัน
};

// =============================================
// DISCOUNT COUPONS
// =============================================
export const DISCOUNT_COUPONS = {
  // Coupon สำหรับลูกค้าใหม่
  WELCOME2025: {
    code: 'WELCOME2025',
    discount_type: 'percentage', // 'percentage' หรือ 'fixed'
    discount_value: 10, // 10%
    min_purchase_amount: 29900, // ต้องซื้อขั้นต่ำ ฿299
    max_discount_amount: 50000, // ลดสูงสุด ฿500
    valid_from: '2025-01-01',
    valid_until: '2025-12-31',
    usage_limit: null, // null = ไม่จำกัดจำนวนครั้ง
    usage_limit_per_user: 1, // 1 ครั้งต่อผู้ใช้
    applicable_plans: ['starter_yearly', 'pro_yearly', 'business_yearly', 'unlimited_yearly'], // ใช้ได้กับแพ็กเกจรายปีเท่านั้น
    is_active: true,
  },

  // Coupon สำหรับช่วงเทศกาล
  NEWYEAR50: {
    code: 'NEWYEAR50',
    discount_type: 'percentage',
    discount_value: 50, // ลด 50%
    min_purchase_amount: 0,
    max_discount_amount: 100000, // ลดสูงสุด ฿1,000
    valid_from: '2025-12-25',
    valid_until: '2026-01-05',
    usage_limit: 100, // จำกัด 100 คนแรก
    usage_limit_per_user: 1,
    applicable_plans: null, // null = ใช้ได้กับทุกแพ็กเกจ
    is_active: false, // ยังไม่เปิดใช้
  },

  // Coupon จำนวนเงินคงที่
  SAVE100: {
    code: 'SAVE100',
    discount_type: 'fixed',
    discount_value: 10000, // ลด ฿100
    min_purchase_amount: 50000, // ต้องซื้อขั้นต่ำ ฿500
    max_discount_amount: 10000,
    valid_from: '2025-01-01',
    valid_until: '2025-12-31',
    usage_limit: null,
    usage_limit_per_user: 1,
    applicable_plans: null,
    is_active: true,
  },
};

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * คำนวณราคาหลังหักส่วนลด
 */
export function calculateDiscountedPrice(planKey, couponCode = null) {
  const plan = PRICING_PLANS[planKey];
  if (!plan) {
    throw new Error(`Plan ${planKey} not found`);
  }

  let price = plan.price;
  let discount = 0;
  let coupon = null;

  if (couponCode) {
    coupon = DISCOUNT_COUPONS[couponCode];
    if (!coupon) {
      throw new Error(`Coupon ${couponCode} not found`);
    }

    // ตรวจสอบความถูกต้อง
    if (!coupon.is_active) {
      throw new Error('Coupon is not active');
    }

    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = new Date(coupon.valid_until);

    if (now < validFrom || now > validUntil) {
      throw new Error('Coupon has expired or not yet valid');
    }

    // ตรวจสอบว่าใช้ได้กับแพ็กเกจนี้หรือไม่
    if (coupon.applicable_plans && !coupon.applicable_plans.includes(planKey)) {
      throw new Error('Coupon is not applicable to this plan');
    }

    // ตรวจสอบ min purchase
    if (price < coupon.min_purchase_amount) {
      throw new Error(`Minimum purchase amount is ${coupon.min_purchase_amount / 100} THB`);
    }

    // คำนวณส่วนลด
    if (coupon.discount_type === 'percentage') {
      discount = Math.floor((price * coupon.discount_value) / 100);
      if (discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    } else if (coupon.discount_type === 'fixed') {
      discount = coupon.discount_value;
    }
  }

  const finalPrice = Math.max(0, price - discount);

  return {
    original_price: price,
    discount,
    final_price: finalPrice,
    coupon: coupon ? {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
    } : null,
  };
}

/**
 * ดึงข้อมูลแพ็กเกจทั้งหมดที่ active
 */
export function getActivePlans(filterType = null) {
  return Object.values(PRICING_PLANS)
    .filter((plan) => plan.is_active)
    .filter((plan) => !filterType || plan.billing_type === filterType)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * ดึงข้อมูลแพ็กเกจตาม key
 */
export function getPlanByKey(planKey) {
  return PRICING_PLANS[planKey] || null;
}

/**
 * แปลงราคาเป็นรูปแบบที่อ่านง่าย
 */
export function formatPrice(amount, currency = 'thb') {
  const price = amount / 100;
  if (currency === 'thb') {
    return `฿${price.toLocaleString('th-TH')}`;
  }
  return `$${price.toFixed(2)}`;
}

/**
 * ตรวจสอบ quota
 */
export function checkQuotaLimit(usage, limit) {
  if (limit === -1) {
    return {
      ok: true,
      usage,
      limit: 'unlimited',
      percent: 0,
      remaining: Infinity,
      in_grace_period: false,
    };
  }

  const percent = (usage / limit) * 100;
  const remaining = Math.max(0, limit - usage);
  const graceLimit = Math.floor(limit * QUOTA_CONFIG.GRACE_PERIOD_MULTIPLIER);
  const inGracePeriod = usage >= limit && usage < graceLimit;
  const ok = usage < graceLimit;

  return {
    ok,
    usage,
    limit,
    percent: Math.round(percent),
    remaining,
    in_grace_period: inGracePeriod,
    warning_level:
      percent >= 100
        ? 'critical'
        : percent >= QUOTA_CONFIG.WARNING_THRESHOLD_PERCENT
        ? 'warning'
        : 'ok',
  };
}

export default {
  PRICING_PLANS,
  QUOTA_CONFIG,
  DISCOUNT_COUPONS,
  calculateDiscountedPrice,
  getActivePlans,
  getPlanByKey,
  formatPrice,
  checkQuotaLimit,
};
