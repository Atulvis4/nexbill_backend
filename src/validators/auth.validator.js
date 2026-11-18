import { z } from 'zod';

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().toLowerCase(),
    businessName: z.string().trim().min(2).max(100),
    password: z.string().min(8).max(128),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().toLowerCase(),
    password: z.string().min(1),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  }),
});

const forgotPasswordRequestSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email().toLowerCase().optional(),
    token: z.string().optional(),
    otp: z.string().optional(),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  }).refine((data) => data.token || data.otp, {
    message: 'Either reset token or OTP code is required',
    path: ['token'],
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }),
});

export {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema,
};
