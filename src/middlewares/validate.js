import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const validate = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join(', ');
    return next(new ApiError(httpStatus.BAD_REQUEST, details));
  }

  if (parsed.data.body) req.body = parsed.data.body;
  if (parsed.data.params) Object.assign(req.params, parsed.data.params);
  if (parsed.data.query) Object.assign(req.query, parsed.data.query);
  return next();
};

export { validate };
export default validate;
