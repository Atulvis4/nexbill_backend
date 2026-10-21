import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from '../config/constants.js';

const getProfile = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Business not found');
  }
  return business;
};

const updateProfile = async (businessId, data) => {
  return await prisma.business.update({
    where: { id: businessId },
    data,
  });
};

const getSettings = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      gstEnabled: true,
      compositionScheme: true,
      defaultTaxRate: true,
      rcmEnabled: true,
      showHsnColumn: true,
      calculateTaxBeforeDiscount: true,
      printTemplateStyle: true,
      printPageSize: true,
      printShowLogo: true,
      printBankDetails: true,
      printTermsFooter: true,
    },
  });
  if (!business) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Business not found');
  }
  return business;
};

const updateSettings = async (businessId, data) => {
  return await prisma.business.update({
    where: { id: businessId },
    data,
  });
};

const getNumbering = async (businessId) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      numberingSalesPrefix: true,
      numberingSalesNext: true,
      numberingPurchasePrefix: true,
      numberingPurchaseNext: true,
      numberingEstimatePrefix: true,
      numberingEstimateNext: true,
      numberingChallanPrefix: true,
      numberingChallanNext: true,
      numberingOrderPrefix: true,
      numberingOrderNext: true,
      numberingReturnPrefix: true,
      numberingReturnNext: true,
      numberingReceiptPrefix: true,
      numberingReceiptNext: true,
    },
  });
  if (!business) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Business not found');
  }
  return business;
};

const updateNumbering = async (businessId, data) => {
  return await prisma.business.update({
    where: { id: businessId },
    data,
  });
};

const getNextNumber = async (businessId, type) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Business not found');
  }

  let prefix;
  let nextVal;

  switch (type.toLowerCase()) {
    case 'sales':
      prefix = business.numberingSalesPrefix || `INV-${businessId}-`;
      nextVal = business.numberingSalesNext;
      break;
    case 'purchase':
      prefix = business.numberingPurchasePrefix || `PUR-${businessId}-`;
      nextVal = business.numberingPurchaseNext;
      break;
    case 'estimate':
      prefix = business.numberingEstimatePrefix || `EST-${businessId}-`;
      nextVal = business.numberingEstimateNext;
      break;
    case 'challan':
      prefix = business.numberingChallanPrefix || `CHL-${businessId}-`;
      nextVal = business.numberingChallanNext;
      break;
    case 'order':
      prefix = business.numberingOrderPrefix || `ORD-${businessId}-`;
      nextVal = business.numberingOrderNext;
      break;
    case 'return':
      prefix = business.numberingReturnPrefix || `RET-${businessId}-`;
      nextVal = business.numberingReturnNext;
      break;
    case 'receipt':
      prefix = business.numberingReceiptPrefix || `RCP-${businessId}-`;
      nextVal = business.numberingReceiptNext;
      break;
    case 'paymentout':
      prefix = business.numberingPaymentOutPrefix || `POUT-${businessId}-`;
      nextVal = business.numberingPaymentOutNext;
      break;
    case 'debitnote':
      prefix = business.numberingDebitNotePrefix || `DN-${businessId}-`;
      nextVal = business.numberingDebitNoteNext;
      break;
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid document type for numbering');
  }

  return {
    prefix,
    nextNumber: nextVal,
    formatted: `${prefix}${nextVal}`,
  };
};

const uploadLogo = async (businessId, fileUrl) => {
  return await prisma.business.update({
    where: { id: businessId },
    data: { logoUrl: fileUrl },
  });
};

const uploadSignature = async (businessId, fileUrl) => {
  return await prisma.business.update({
    where: { id: businessId },
    data: { signatureUrl: fileUrl },
  });
};

const businessService = {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getNumbering,
  updateNumbering,
  getNextNumber,
  uploadLogo,
  uploadSignature,
};

export { businessService };
export default businessService;
