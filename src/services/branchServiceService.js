import prisma from "../config/prisma.js";

/**
 * Lấy danh sách dịch vụ của 1 chi nhánh (kèm chi tiết Branch và Service)
 */
const getByBranch = async (branchId, filters = {}) => {
  return await prisma.branchServices.findMany({
    where: {
      BranchID: branchId,
      ...filters,
    },
    include: {
      Services: true,
      branches: true,
    },
    orderBy: { BranchServiceID: "asc" },
  });
};

/**
 * Lấy danh sách public cho khách hàng
 * Trả về danh sách dịch vụ Active, tính sẵn ActualPrice
 */
const getPublicByBranch = async (branchId) => {
  const branchServices = await prisma.branchServices.findMany({
    where: {
      BranchID: branchId,
      Status: "Active",
      Services: {
        Status: "Active", // Đảm bảo dịch vụ gốc cũng đang Active
      },
    },
    include: {
      Services: true,
    },
  });

  // Map lại dữ liệu cho gọn, tính ActualPrice
  return branchServices.map((bs) => {
    const s = bs.Services;
    return {
      BranchServiceID: bs.BranchServiceID,
      ServiceID: s.ServiceID,
      ServiceName: s.ServiceName,
      Description: s.Description,
      DurationMinutes: s.DurationMinutes,
      Type: s.Type,
      BasePrice: s.BasePrice,
      PriceOverride: bs.PriceOverride,
      // ActualPrice: Nếu chi nhánh có giá riêng thì dùng, không thì lấy BasePrice
      ActualPrice: bs.PriceOverride !== null ? bs.PriceOverride : s.BasePrice,
    };
  });
};

/**
 * Chi tiết 1 bản ghi BranchService
 */
const getById = async (id) => {
  return await prisma.branchServices.findUnique({
    where: { BranchServiceID: id },
    include: { Services: true, branches: true },
  });
};

/**
 * Gán dịch vụ cho chi nhánh
 */
const create = async (data) => {
  // Kiểm tra Branch tồn tại
  const branchExists = await prisma.branches.findUnique({
    where: { BranchID: data.BranchID },
  });
  if (!branchExists) throw new Error("Chi nhánh không tồn tại");

  // Kiểm tra Service tồn tại
  const serviceExists = await prisma.services.findUnique({
    where: { ServiceID: data.ServiceID },
  });
  if (!serviceExists) throw new Error("Dịch vụ gốc không tồn tại");

  // Kiểm tra trùng lặp
  const existing = await prisma.branchServices.findFirst({
    where: {
      BranchID: data.BranchID,
      ServiceID: data.ServiceID,
    },
  });
  if (existing) {
    throw new Error("Dịch vụ này đã được gán cho chi nhánh. Hãy cập nhật thay vì tạo mới.");
  }

  return await prisma.branchServices.create({
    data,
    include: { Services: true },
  });
};

/**
 * Cập nhật giá hoặc trạng thái
 */
const update = async (id, data) => {
  return await prisma.branchServices.update({
    where: { BranchServiceID: id },
    data,
    include: { Services: true },
  });
};

/**
 * Xóa mềm (Status = Inactive)
 */
const deleteSoft = async (id) => {
  return await prisma.branchServices.update({
    where: { BranchServiceID: id },
    data: { Status: "Inactive" },
  });
};

export default {
  getByBranch,
  getPublicByBranch,
  getById,
  create,
  update,
  deleteSoft,
};
