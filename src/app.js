import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

import env from './config/env.js';
import apiLimiter from './middlewares/rateLimiter.js';
import notFoundHandler from './middlewares/notFoundHandler.js';
import errorHandler from './middlewares/errorHandler.js';
import routes from './routes/index.js';
import logger from './utils/logger.js';

const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-business-id"],
    exposedHeaders: ["Content-Length", "Date", "Content-Disposition", "ETag", "x-business-id", "x-api-key", "x-rate-limit-limit", "x-rate-limit-remaining", "x-rate-limit-reset", "x-token-expiry"],
  }),
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
// Request logging — write directly to stdout so nodemon never buffers it
app.use((req, _res, next) => {
  process.stdout.write(`[REQ] ${req.method} ${req.originalUrl}\n`);
  next();
});
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : ':method :url :status :res[content-length] - :response-time ms'));
app.use(apiLimiter);


app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);
app.use(env.API_PREFIX, routes);
app.use(notFoundHandler);
app.use(errorHandler);

logger.info(`API prefix configured at ${env.API_PREFIX}`);

export default app;
