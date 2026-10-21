import prisma from '../config/prisma.js';
import httpStatus from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import sanitizeUser from '../utils/sanitize.js';

const getById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.name)
  );
  const uniquePermissions = [...new Set(permissions)];

  const sanitizedUser = sanitizeUser(user);
  sanitizedUser.roles = roles;
  sanitizedUser.permissions = uniquePermissions;

  return sanitizedUser;
};

const userService = {
  getById,
};

export { userService };
export default userService;
