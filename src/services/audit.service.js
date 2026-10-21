import prisma from '../config/prisma.js';

const logDocumentAction = async ({
  tx,
  businessId,
  documentType,
  documentId,
  documentNo,
  action,
  changes,
  userId
}) => {
  const db = tx || prisma;
  return await db.documentAuditLog.create({
    data: {
      businessId,
      documentType,
      documentId: Number(documentId),
      documentNo,
      action,
      changes: changes || {},
      userId: userId || null
    }
  });
};

const getDocumentAuditHistory = async (businessId, documentType, documentId) => {
  return await prisma.documentAuditLog.findMany({
    where: {
      businessId,
      documentType,
      documentId: Number(documentId)
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

export default {
  logDocumentAction,
  getDocumentAuditHistory
};
