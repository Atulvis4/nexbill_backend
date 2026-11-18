import prisma from '../config/prisma.js';
import httpStatus from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import sanitizeUser from '../utils/sanitize.js';

const register = async ({ name, email, businessName, password }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, 'Email is already registered');
  }

  // Retrieve the default USER role
  const defaultRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  if (!defaultRole) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Default authorization role "USER" is not configured'
    );
  }

  const hashedPassword = await hashPassword(password);

  const { user, business } = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        userRoles: {
          create: {
            roleId: defaultRole.id,
          },
        },
      },
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

    const newBusiness = await tx.business.create({
      data: {
        name: businessName,
      },
    });

    await tx.businessMember.create({
      data: {
        businessId: newBusiness.id,
        userId: newUser.id,
        role: 'OWNER',
      },
    });

    return { user: newUser, business: newBusiness };
  });

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.name)
  );
  const uniquePermissions = [...new Set(permissions)];

  const token = signToken({ id: user.id });

  const sanitizedUser = sanitizeUser(user);
  sanitizedUser.roles = roles;
  sanitizedUser.permissions = uniquePermissions;
  sanitizedUser.activeBusiness = {
    id: business.id,
    name: business.name,
    role: 'OWNER',
  };

  return { user: sanitizedUser, token };
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
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

  if (!user || !(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.name)
  );
  const uniquePermissions = [...new Set(permissions)];

  const member = await prisma.businessMember.findFirst({
    where: { userId: user.id },
    include: { business: true },
  });

  const token = signToken({ id: user.id });

  const sanitizedUser = sanitizeUser(user);
  sanitizedUser.roles = roles;
  sanitizedUser.permissions = uniquePermissions;
  if (member) {
    sanitizedUser.activeBusiness = {
      id: member.business.id,
      name: member.business.name,
      role: member.role,
    };
  }
  console.log(sanitizedUser.activeBusiness);

  return { user: sanitizedUser, token };
};

// In-memory store for OTP & Reset tokens (15-min expiry)
const passwordResetStore = new Map();

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'New password must be different from current password');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true, message: 'Password changed successfully' };
};

const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No account found with this email address');
  }

  // 6-digit verification code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Time-limited reset token (15 mins)
  const token = signToken({ id: user.id, email: normalizedEmail, purpose: 'pwd_reset' });

  const expiresAt = Date.now() + 15 * 60 * 1000;
  passwordResetStore.set(normalizedEmail, {
    userId: user.id,
    otp,
    token,
    expiresAt,
  });

  // Auto clean up after 15 mins
  setTimeout(() => {
    if (passwordResetStore.get(normalizedEmail)?.otp === otp) {
      passwordResetStore.delete(normalizedEmail);
    }
  }, 15 * 60 * 1000);

  console.log(`\n======================================================`);
  console.log(`[PASSWORD RESET] Verification Code for ${normalizedEmail}: ${otp}`);
  console.log(`[PASSWORD RESET] Reset Token: ${token}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    message: 'Password reset code has been sent/generated. Valid for 15 minutes.',
    email: normalizedEmail,
    otp,
    token,
    expiresInMinutes: 15,
  };
};

const resetPassword = async ({ email, token, otp, newPassword }) => {
  let user = null;

  if (email && otp) {
    const normalizedEmail = email.trim().toLowerCase();
    const cached = passwordResetStore.get(normalizedEmail);
    if (!cached || cached.otp !== String(otp).trim() || cached.expiresAt < Date.now()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP code. Please request a new one.');
    }
    user = await prisma.user.findUnique({ where: { id: cached.userId } });
    passwordResetStore.delete(normalizedEmail);
  } else if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded.purpose !== 'pwd_reset') {
        throw new Error();
      }
      user = await prisma.user.findUnique({ where: { id: decoded.id } });
    } catch {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired reset token. Please request a new one.');
    }
  }

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid password reset request');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return {
    success: true,
    message: 'Password has been successfully reset. You can now login with your new password.',
  };
};

const authService = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
};

export { authService };
export default authService;
