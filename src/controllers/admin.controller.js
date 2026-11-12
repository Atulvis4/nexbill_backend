import prisma from '../config/prisma.js';
import httpStatus from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import { comparePassword } from '../utils/password.js';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendSuccess from '../utils/response.js';

const signAdminToken = (payload) =>
  jwt.sign(payload, env.ADMIN_JWT_SECRET || env.JWT_SECRET, {
    expiresIn: env.ADMIN_JWT_EXPIRES_IN || '7d',
  });

const verifyAdminToken = (token) => {
  try {
    return jwt.verify(token, env.ADMIN_JWT_SECRET || env.JWT_SECRET);
  } catch {
    return jwt.verify(token, env.JWT_SECRET);
  }
};

const authenticateAdmin = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Admin authentication token is required'));
  }

  try {
    const decoded = verifyAdminToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Admin user not found'));
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    if (!roles.includes('ADMIN')) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Access denied: Admin privileges required'));
    }

    req.admin = {
      id: user.id,
      email: user.email,
      name: user.name || 'Super Admin',
      role: 'SUPER_ADMIN',
    };

    return next();
  } catch {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired admin token'));
  }
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  if (!user || !(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  const roles = user.userRoles.map((ur) => ur.role.name);
  if (!roles.includes('ADMIN')) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied: Not an administrator account');
  }

  const token = signAdminToken({ id: user.id, email: user.email, role: 'SUPER_ADMIN' });

  const admin = {
    id: user.id,
    email: user.email,
    name: user.name || 'Super Admin',
    role: 'SUPER_ADMIN',
  };

  sendSuccess(res, httpStatus.OK, 'Admin authentication successful', { token, admin });
});

const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, httpStatus.OK, 'Admin profile fetched', req.admin);
});

const getDashboardStats = asyncHandler(async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalOrgs, totalUsers, newUsersLast30Days, totalInvoices, auditLogs] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.salesInvoice.count({ where: { isArchived: false } }),
    prisma.documentAuditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const salesAgg = await prisma.salesInvoice.aggregate({
    where: { isArchived: false },
    _sum: { grandTotal: true },
  });

  const totalRevenue = Number(salesAgg._sum.grandTotal || 0);

  const stats = {
    organisations: {
      total: totalOrgs,
      active: totalOrgs,
      trialing: 0,
      suspended: 0,
    },
    users: {
      total: totalUsers,
      newSignupsLast30Days: newUsersLast30Days,
    },
    invoices: {
      total: totalInvoices,
      paid: totalInvoices,
    },
    financials: {
      mrr: Math.round(totalRevenue / 12),
      arr: totalRevenue,
      totalRevenue,
    },
    recentAuditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      documentType: log.documentType,
      documentNo: log.documentNo,
      userName: log.user?.name || log.user?.email || 'System',
      createdAt: log.createdAt,
    })),
  };

  sendSuccess(res, httpStatus.OK, 'Admin dashboard stats fetched', stats);
});

const listOrganisations = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const where = {};

  if (search) {
    where.name = { contains: String(search) };
  }

  const [orgs, total] = await Promise.all([
    prisma.business.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            salesInvoices: true,
            parties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.count({ where }),
  ]);

  const mapped = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    email: org.email || '',
    phone: org.phone || '',
    status: 'ACTIVE',
    planCode: 'GROWTH',
    memberCount: org._count.members,
    invoiceCount: org._count.salesInvoices,
    partyCount: org._count.parties,
    createdAt: org.createdAt,
  }));

  sendSuccess(res, httpStatus.OK, 'Organisations fetched', { data: mapped, total });
});

const listUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: String(search) } },
      { email: { contains: String(search) } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        userRoles: { include: { role: true } },
        businessMembers: { include: { business: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name || '',
    email: u.email,
    roles: u.userRoles.map((ur) => ur.role.name),
    isActive: true,
    organisations: u.businessMembers.map((bm) => ({
      id: bm.business.id,
      name: bm.business.name,
      role: bm.role,
    })),
    createdAt: u.createdAt,
  }));

  sendSuccess(res, httpStatus.OK, 'Users fetched', { data: mapped, total });
});

const listPlans = asyncHandler(async (_req, res) => {
  const plans = [
    {
      id: 'FREE',
      name: 'Free Starter',
      code: 'FREE',
      price: 0,
      billingCycle: 'MONTHLY',
      features: ['Up to 50 invoices/mo', '1 Business user', 'Basic reports'],
      isActive: true,
    },
    {
      id: 'GROWTH',
      name: 'Growth Business',
      code: 'GROWTH',
      price: 999,
      billingCycle: 'MONTHLY',
      features: ['Unlimited invoices', 'Up to 5 staff members', 'Advanced profit & loss', 'Inventory tracking'],
      isActive: true,
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise Scale',
      code: 'ENTERPRISE',
      price: 2499,
      billingCycle: 'MONTHLY',
      features: ['Unlimited everything', 'Dedicated database support', 'Priority WhatsApp alerts', 'Multi-device sync'],
      isActive: true,
    },
  ];

  sendSuccess(res, httpStatus.OK, 'Plans fetched', plans);
});

const listSubscriptions = asyncHandler(async (_req, res) => {
  sendSuccess(res, httpStatus.OK, 'Subscriptions fetched', { data: [], total: 0 });
});

const listPayments = asyncHandler(async (_req, res) => {
  sendSuccess(res, httpStatus.OK, 'Payments fetched', { data: [], total: 0 });
});

const listAuditLogs = asyncHandler(async (_req, res) => {
  const [logs, total] = await Promise.all([
    prisma.documentAuditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.documentAuditLog.count(),
  ]);

  const mapped = logs.map((l) => ({
    id: l.id,
    action: l.action,
    documentType: l.documentType,
    documentId: l.documentId,
    documentNo: l.documentNo,
    userName: l.user?.name || l.user?.email || 'System',
    userEmail: l.user?.email || '',
    createdAt: l.createdAt,
  }));

  sendSuccess(res, httpStatus.OK, 'Audit logs fetched', { data: mapped, total });
});

export default {
  authenticateAdmin,
  login,
  getMe,
  getDashboardStats,
  listOrganisations,
  listUsers,
  listPlans,
  listSubscriptions,
  listPayments,
  listAuditLogs,
};

