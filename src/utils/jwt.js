import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const signToken = (payload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);

export { signToken, verifyToken };
