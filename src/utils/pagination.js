/**
 * Pagination Utility for NexBill Backend
 */

export const getPaginationParams = (query = {}, defaults = {}) => {
  const defaultPage = defaults.page || 1;
  const defaultLimit = defaults.limit || 50;
  const maxLimit = defaults.maxLimit || 200;

  const isAll =
    query.all === 'true' ||
    query.all === true ||
    query.limit === '0' ||
    query.limit === 0 ||
    query.pagination === 'false' ||
    query.pagination === false;

  const page = Math.max(1, parseInt(query.page, 10) || defaultPage);
  const requestedLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
    isAll,
  };
};

export const formatPaginatedResponse = (data, total, { page, limit, isAll } = {}) => {
  const safeTotal = typeof total === 'number' ? total : data.length;

  if (isAll) {
    return {
      data,
      pagination: {
        total: safeTotal,
        page: 1,
        limit: safeTotal,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  const safeLimit = Math.max(1, limit || 50);
  const safePage = Math.max(1, page || 1);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  return {
    data,
    pagination: {
      total: safeTotal,
      page: safePage,
      limit: safeLimit,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
};

export default {
  getPaginationParams,
  formatPaginatedResponse,
};

