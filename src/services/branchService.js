import prisma from "../config/prisma.js";

const getAllBranches = async (filters = {}) => {

  const where = { ...filters };


  if (!Object.prototype.hasOwnProperty.call(filters, "Status")) {
    where.Status = { not: "Inactive" };
  }

  return await prisma.branches.findMany({
    where,
    orderBy: { BranchID: "asc" },
  });
};

const getBranchById = async (id) => {
  return await prisma.branches.findUnique({
    where: { BranchID: id },
  });
};

const createBranch = async (data) => {

  return await prisma.branches.create({
    data,
  });
};

const updateBranch = async (id, data) => {
  return await prisma.branches.update({
    where: { BranchID: id },
    data,
  });
};

const deleteBranch = async (id) => {

  return await prisma.branches.update({
    where: { BranchID: id },
    data: { Status: "Inactive" },
  });
};

export default {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
