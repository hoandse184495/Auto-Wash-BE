import prisma from "../config/prisma.js";


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


const getPublicByBranch = async (branchId) => {
  const branchServices = await prisma.branchServices.findMany({
    where: {
      BranchID: branchId,
      Status: "Active",
      Services: {
        Status: "Active",
      },
    },
    include: {
      Services: true,
    },
  });


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

      ActualPrice: bs.PriceOverride !== null ? bs.PriceOverride : s.BasePrice,
    };
  });
};


const getById = async (id) => {
  return await prisma.branchServices.findUnique({
    where: { BranchServiceID: id },
    include: { Services: true, branches: true },
  });
};


const create = async (data) => {

  const branchExists = await prisma.branches.findUnique({
    where: { BranchID: data.BranchID },
  });
  if (!branchExists) throw new Error("Chi nhánh không tồn tại");


  const serviceExists = await prisma.services.findUnique({
    where: { ServiceID: data.ServiceID },
  });
  if (!serviceExists) throw new Error("Dịch vụ gốc không tồn tại");


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


const update = async (id, data) => {
  return await prisma.branchServices.update({
    where: { BranchServiceID: id },
    data,
    include: { Services: true },
  });
};


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
