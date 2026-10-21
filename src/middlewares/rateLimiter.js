import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import httpStatus from '../config/constants.js';

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  skip: () => env.NODE_ENV === 'development',
});

export { apiLimiter };
export default apiLimiter;
