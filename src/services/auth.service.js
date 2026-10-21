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

const authService = {
  register,
  login,
};

export { authService };
export default authService;
