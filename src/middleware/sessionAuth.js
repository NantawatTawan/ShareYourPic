import jwt from 'jsonwebtoken';

// Generate session token for frontend
export const generateSessionToken = (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'JWT not configured'
    });
  }

  // สร้าง token ที่หมดอายุใน 24 ชั่วโมง
  const token = jwt.sign(
    {
      type: 'session',
      timestamp: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token
  });
};

// Verify session token
export const verifySessionToken = (req, res, next) => {
  const token = req.headers['x-session-token'];
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set. Session auth disabled.');
    return next();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Session token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'session') {
      throw new Error('Invalid token type');
    }

    req.session = decoded;
    next();
  } catch (error) {
    console.error('Session token verification failed:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired session token'
    });
  }
};
