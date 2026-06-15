import prisma from "../config/prisma.js";

/**
 * Lấy danh sách dịch vụ (hỗ trợ filter)
 */
const getAllServices = async (filters = {}) => {
  return await prisma.services.findMany({
    where: filters,
    orderBy: { ServiceID: "asc" },
  });
};

/**
 * Lấy chi tiết 1 dịch vụ theo ID
 */
const getServiceById = async (id) => {
  return await prisma.services.findUnique({
    where: { ServiceID: id },
  });
};

/**
 * Tạo dịch vụ mới
 */
const createService = async (data) => {
  return await prisma.services.create({ data });
};

/**
 * Cập nhật dịch vụ
 */
const updateService = async (id, data) => {
  return await prisma.services.update({
    where: { ServiceID: id },
    data,
  });
};

/**
 * Soft Delete: chuyển Status → Inactive
 */
const deleteService = async (id) => {
  return await prisma.services.update({
    where: { ServiceID: id },
    data: { Status: "Inactive" },
  });
};

export default {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
};
