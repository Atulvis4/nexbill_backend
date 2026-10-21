import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

/**
 * Middleware to check if the user has any of the required roles.
 * @param {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication is required'));
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to access this resource'));
    }

    next();
  };
};

/**
 * Middleware to check if the user has all of the required permissions.
 * @param {...string} requiredPermissions
 */
const requirePermission = (...requiredPermissions) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication is required'));
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      req.user.permissions.includes(perm)
    );

    if (!hasAllPermissions) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to access this resource'));
    }

    next();
  };
};

export { requireRole, requirePermission };
