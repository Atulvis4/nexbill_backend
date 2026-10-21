import env from '../config/env.js';
import httpStatus from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

const errorHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof ApiError ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR;
  const message = error instanceof ApiError ? error.message : 'Internal server error';

  logger.error(error);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};

export { errorHandler };
export default errorHandler;
