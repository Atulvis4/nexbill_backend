/* global URL */
import prismaClientPkg from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import env from './env.js';

const { PrismaClient } = prismaClientPkg;

// Parse the connection string dynamically to construct the config object
const dbUrl = new URL(env.DATABASE_URL);
const config = {
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '3306'),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ''),
};

// If it's a remote database, enable SSL/TLS secure transport
if (!dbUrl.hostname.includes('localhost') && !dbUrl.hostname.includes('127.0.0.1')) {
  config.ssl = {
    rejectUnauthorized: true,
  };
}

const adapter = new PrismaMariaDb(config);

const prisma = new PrismaClient({
  adapter,
});

export { prisma };
export default prisma;