import prisma from "../config/prisma.js";

const getAllBranches = async (filters = {}) => {
  return await prisma.branches.findMany({
    where: filters,
    orderBy: { BranchID: "asc" },
  });
};

const getBranchById = async (id) => {
  return await prisma.branches.findUnique({
    where: { BranchID: id },
  });
};

const createBranch = async (data) => {
  // Convert time strings to Date objects if necessary?
  // Prisma accepts Date objects or valid ISO strings for DateTime
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
  // Soft delete: update Status to "Inactive"
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
