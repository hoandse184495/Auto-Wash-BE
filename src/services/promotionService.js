import prisma from "../config/prisma.js";

const getAllPromotions = async (branchId, role) => {
  let whereClause = {};
  if (role === "Manager" && branchId) {
    whereClause.OR = [
      { BranchID: branchId },
      { BranchID: null } // K/m toàn hệ thống
    ];
  }
  
  return await prisma.promotions.findMany({
    where: whereClause,
    orderBy: { StartDate: 'desc' }
  });
};

const getActivePromotions = async () => {
  const now = new Date();
  return await prisma.promotions.findMany({
    where: {
      Status: "Active",
      StartDate: { lte: now },
      EndDate: { gte: now }
    },
    orderBy: { EndDate: 'asc' }
  });
};

const getPromotionById = async (promotionId) => {
  const promo = await prisma.promotions.findUnique({
    where: { PromotionID: promotionId }
  });
  if (!promo) throw new Error("Không tìm thấy mã khuyến mãi");
  return promo;
};

const createPromotion = async (data) => {
  return await prisma.promotions.create({
    data: {
      PromotionName: data.PromotionName,
      BranchID: data.BranchID || null,
      DiscountType: data.DiscountType, // PERCENTAGE or FIXED_AMOUNT
      DiscountValue: data.DiscountValue,
      StartDate: data.StartDate ? new Date(data.StartDate) : new Date(),
      EndDate: data.EndDate ? new Date(data.EndDate) : null,
      UsageLimit: data.UsageLimit || null,
      Status: "Active"
    }
  });
};

const updatePromotion = async (promotionId, data) => {
  await getPromotionById(promotionId);

  return await prisma.promotions.update({
    where: { PromotionID: promotionId },
    data: {
      PromotionName: data.PromotionName,
      BranchID: data.BranchID,
      DiscountType: data.DiscountType,
      DiscountValue: data.DiscountValue,
      StartDate: data.StartDate ? new Date(data.StartDate) : undefined,
      EndDate: data.EndDate ? new Date(data.EndDate) : undefined,
      UsageLimit: data.UsageLimit,
      Status: data.Status
    }
  });
};

const deletePromotion = async (promotionId) => {
  await getPromotionById(promotionId);
  return await prisma.promotions.update({
    where: { PromotionID: promotionId },
    data: { Status: "Inactive" }
  });
};

export default {
  getAllPromotions,
  getActivePromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion
};
