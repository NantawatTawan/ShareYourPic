import axios from 'axios';

// reCAPTCHA v3 verification middleware
export const verifyRecaptcha = async (req, res, next) => {
  const recaptchaToken = req.headers['x-recaptcha-token'];
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

  // Skip if not configured (development)
  if (!recaptchaSecret) {
    console.warn('⚠️  RECAPTCHA_SECRET_KEY not set. Recaptcha verification disabled.');
    return next();
  }

  // Require token in production
  if (!recaptchaToken) {
    return res.status(400).json({
      success: false,
      message: 'Recaptcha verification required'
    });
  }

  try {
    // Verify with Google
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: recaptchaSecret,
          response: recaptchaToken
        }
      }
    );

    const { success, score } = response.data;

    // Check if verification passed and score is acceptable
    // Score 0.0 = bot, 1.0 = human
    if (!success || score < 0.5) {
      console.log(`❌ Recaptcha failed. Score: ${score}`);
      return res.status(403).json({
        success: false,
        message: 'Recaptcha verification failed. Please try again.'
      });
    }

    console.log(`✅ Recaptcha passed. Score: ${score}`);
    next();
  } catch (error) {
    console.error('Recaptcha verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify recaptcha'
    });
  }
};

// Apply recaptcha only to specific routes (upload, payment)
export const recaptchaForCriticalRoutes = (req, res, next) => {
  // Only check recaptcha for sensitive operations
  const path = req.path;
  const isCriticalRoute =
    path.includes('/upload') ||
    path.includes('/payment/create') ||
    path.includes('/comment');

  if (isCriticalRoute) {
    return verifyRecaptcha(req, res, next);
  }

  next();
};
