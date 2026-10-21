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

export { registerSchema, loginSchema };
