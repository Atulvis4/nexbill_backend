import prisma from '../src/config/prisma.js';
import { seedRolesAndPermissions } from './role-permission/rolePermission.seeder.js';

async function main() {
  console.log('--- Database Seeding Started ---');

  await seedRolesAndPermissions();

  console.log('--- Database Seeding Completed ---');
}

main()
  .catch((e) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
