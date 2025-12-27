import crypto from 'crypto';

// สร้าง session ID จาก IP + User Agent
export const generateSessionId = (req) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const sessionString = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(sessionString).digest('hex');
};

// ดึง IP address
export const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    null
  );
};

export default {
  generateSessionId,
  getClientIp
};
