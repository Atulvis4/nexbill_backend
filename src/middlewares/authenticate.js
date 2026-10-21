import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';
import httpStatus from '../config/constants.js';
import prisma from '../config/prisma.js';

const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication token is required'));
  }

  try {
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'User not found or account deactivated'));
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.name)
    );
    const uniquePermissions = [...new Set(permissions)];

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions: uniquePermissions,
    };

    return next();
  } catch (_error) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token'));
  }
};

export { authenticate };
export default authenticate;
