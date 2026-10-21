import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const notFoundHandler = (req, _res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
};

export { notFoundHandler };
export default notFoundHandler;
