import prisma from "../config/prisma.js";

/**
 * Lấy CustomerID từ UserID.
 * NẾU CHƯA CÓ TRONG BẢNG Customers, TỰ ĐỘNG TẠO MỚI.
 */
const getOrCreateCustomer = async (userId) => {
  // Tìm CustomerID hiện tại
  let customer = await prisma.customers.findFirst({
    where: { UserID: userId },
  });

  // Nếu chưa có, tự tạo mới (Lazy Creation)
  if (!customer) {
    customer = await prisma.customers.create({
      data: {
        UserID: userId,
        TotalVisits: 0,
        TotalSpent: 0,
      },
    });
  }

  return customer.CustomerID;
};

/**
 * Lấy danh sách xe
 */
const getAll = async (filters = {}) => {
  return await prisma.vehicles.findMany({
    where: {
      ...filters,
    },
    include: {
      Customers: {
        include: { Users: { select: { FullName: true, Phone: true } } },
      },
    },
    orderBy: { VehicleID: "asc" },
  });
};

/**
 * Lấy chi tiết xe
 */
const getById = async (id) => {
  return await prisma.vehicles.findUnique({
    where: { VehicleID: id },
  });
};

/**
 * Tạo xe mới
 */
const create = async (data) => {
  // Kiểm tra trùng biển số trong danh sách xe đang Active
  const existing = await prisma.vehicles.findFirst({
    where: {
      LicensePlate: data.LicensePlate,
      Status: "Active",
    },
  });

  if (existing) {
    throw new Error("Biển số xe này đã được đăng ký trong hệ thống!");
  }

  return await prisma.vehicles.create({
    data,
  });
};

/**
 * Cập nhật thông tin xe
 */
const update = async (id, data) => {
  // Nếu có đổi biển số, kiểm tra trùng (trừ chính xe đang sửa)
  if (data.LicensePlate) {
    const existing = await prisma.vehicles.findFirst({
      where: {
        LicensePlate: data.LicensePlate,
        Status: "Active",
        NOT: { VehicleID: id },
      },
    });
    if (existing) throw new Error("Biển số xe mới đã bị trùng với xe khác!");
  }

  return await prisma.vehicles.update({
    where: { VehicleID: id },
    data,
  });
};

/**
 * Xóa mềm (Soft Delete)
 */
const deleteSoft = async (id) => {
  return await prisma.vehicles.update({
    where: { VehicleID: id },
    data: { Status: "Inactive" },
  });
};

export default {
  getOrCreateCustomer,
  getAll,
  getById,
  create,
  update,
  deleteSoft,
};
