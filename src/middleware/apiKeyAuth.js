// API Key Authentication Middleware
// ป้องกันการเรียกใช้ API จาก Postman หรือ tools อื่นๆ

export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  // ถ้าไม่มี API_KEY ใน env ให้ skip (สำหรับ development)
  if (!validApiKey) {
    console.warn('⚠️  API_KEY not set in environment. API key check is disabled.');
    return next();
  }

  // ตรวจสอบ API key
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  next();
};

// Middleware สำหรับ endpoints ที่ต้องการความปลอดภัยสูง
export const requireStrictApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    return res.status(500).json({
      success: false,
      message: 'API key authentication is not configured'
    });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing API key'
    });
  }

  next();
};
