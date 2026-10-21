import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB seeding...');

  // 1. Roles
  const roles = [
    { id: 1, name: 'ADMIN', description: 'Administrator with full access' },
    { id: 2, name: 'USER', description: 'Standard user with limited access' },
  ];

  console.log('Seeding Roles...');
  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: {
        name: role.name,
        description: role.description,
      },
      create: {
        id: role.id,
        name: role.name,
        description: role.description,
      },
    });
  }
  console.log('✔ Seeded roles.');

  // 2. Permissions
  const permissions = [
    { id: 1, name: 'read:profile', description: 'View own user profile' },
    { id: 2, name: 'write:profile', description: 'Update own user profile' },
    { id: 3, name: 'manage:users', description: 'Create, read, update, and delete users' },
    { id: 4, name: 'manage:roles', description: 'Manage roles and permission associations' },
  ];

  console.log('Seeding Permissions...');
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { id: permission.id },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        id: permission.id,
        name: permission.name,
        description: permission.description,
      },
    });
  }
  console.log('✔ Seeded permissions.');

  // 3. RolePermissions
  const rolePermissions = [
    { roleId: 1, permissionId: 1 },
    { roleId: 1, permissionId: 2 },
    { roleId: 1, permissionId: 3 },
    { roleId: 1, permissionId: 4 },
    { roleId: 2, permissionId: 1 },
    { roleId: 2, permissionId: 2 },
  ];

  console.log('Seeding Role-Permission associations...');
  for (const rp of rolePermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: rp.roleId,
          permissionId: rp.permissionId,
        },
      },
      update: {},
      create: {
        roleId: rp.roleId,
        permissionId: rp.permissionId,
      },
    });
  }
  console.log('✔ Seeded role permission associations.');

  console.log('DB Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
