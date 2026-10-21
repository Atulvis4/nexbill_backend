import prisma from '../../src/config/prisma.js';
import { roles, permissions, rolePermissions } from './rolePermission.data.js';

export async function seedRolesAndPermissions() {
  console.log('Seeding Roles and Permissions...');

  // 1. Create/Upsert Permissions
  const seededPermissions = {};
  for (const perm of permissions) {
    const dbPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    seededPermissions[perm.name] = dbPerm;
    console.log(`  Permission: [${perm.name}] upserted`);
  }

  // 2. Create/Upsert Roles
  const seededRoles = {};
  for (const role of roles) {
    const dbRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    seededRoles[role.name] = dbRole;
    console.log(`  Role: [${role.name}] upserted`);
  }

  // 3. Connect Roles and Permissions
  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const roleId = seededRoles[roleName]?.id;
    if (!roleId) continue;

    for (const permName of permNames) {
      const permissionId = seededPermissions[permName]?.id;
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
      console.log(`  Linked Permission [${permName}] to Role [${roleName}]`);
    }
  }
}
