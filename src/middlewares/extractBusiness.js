import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const extractBusiness = async (req, _res, next) => {
  const businessIdHeader = req.headers['x-business-id'];
  const businessIdQuery = req.query.businessId;

  // Prefer the explicit header; fall back to query param only (never from body to prevent injection)
  const businessIdVal = businessIdHeader || businessIdQuery;


  try {
    if (businessIdVal) {
      const businessId = parseInt(businessIdVal, 10);
      if (isNaN(businessId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid Business ID format'));
      }

      const member = await prisma.businessMember.findFirst({
        where: {
          userId: req.user.id,
          businessId: businessId,
        },
      });

      if (!member) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this business'));
      }

      req.businessId = businessId;
      req.businessMember = member;
      return next();
    } else {
      // Fallback: Find the first business user is a member of
      const member = await prisma.businessMember.findFirst({
        where: { userId: req.user.id },
      });

      if (!member) {
        return next(
          new ApiError(
            httpStatus.BAD_REQUEST,
            'Active business is required. Please create or select a business first.'
          )
        );
      }

      req.businessId = member.businessId;
      req.businessMember = member;
      return next();
    }
  } catch (error) {
    return next(error);
  }
};

export { extractBusiness };
export default extractBusiness;
