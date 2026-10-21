import app from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import prisma from './config/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully.`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', error);
  server.close(() => process.exit(1));
});

// server reload trigger final

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});
