import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import httpStatus from '../config/constants.js';

// Base helper for consistent rate limiter responses
const createLimiter = ({ windowMs, limit, message }) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: {
      success: false,
      message,
    },
    // In development allow slightly higher or testable limits unless testing rate limiter
    skip: () => false,
  });
};

// 1. Login Limiter: Max 10 attempts per 15 mins per IP
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts. Please try again after 15 minutes.',
});

// 2. Forgot Password OTP Request Limiter: Max 5 requests per 15 mins
export const forgotPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many OTP requests. Please wait 15 minutes before requesting again.',
});

// 3. Reset Password (Verify OTP) Limiter: Max 5 attempts per 15 mins
export const resetPasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset attempts. Please wait 15 minutes before trying again.',
});

// 4. Change Password in Settings: Max 10 attempts per 15 mins
export const changePasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many password change attempts. Please try again later.',
});

// 5. Heavy Backup / File Upload Limiter: Max 10 uploads per hour
export const backupUploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Hourly upload limit reached. Please wait before uploading another backup.',
});

// 6. Reports & Heavy Aggregations Limiter: Max 120 queries per minute
export const reportsLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Report query rate limit reached. Please slow down and try again shortly.',
});

// 7. General API Limiter (Fallback for general CRUD): 300 requests / 15 mins
export const apiLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  limit: env.RATE_LIMIT_MAX || 300,
  message: 'Too many requests from this IP. Please try again later.',
});

export default apiLimiter;
