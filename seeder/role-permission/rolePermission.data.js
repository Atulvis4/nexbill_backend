export const permissions = [
  { name: 'read:profile', description: 'View own user profile' },
  { name: 'write:profile', description: 'Update own user profile' },
  { name: 'manage:users', description: 'Create, read, update, and delete users' },
  { name: 'manage:roles', description: 'Manage roles and permission associations' },
];

export const roles = [
  { name: 'ADMIN', description: 'Administrator with full access' },
  { name: 'USER', description: 'Standard user with limited access' },
];

export const rolePermissions = {
  ADMIN: [
    'read:profile',
    'write:profile',
    'manage:users',
    'manage:roles',
  ],
  USER: [
    'read:profile',
    'write:profile',
  ],
};
