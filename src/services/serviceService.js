import prisma from "../config/prisma.js";


const getAllServices = async (filters = {}) => {
  return await prisma.services.findMany({
    where: filters,
    orderBy: { ServiceID: "asc" },
  });
};


const getServiceById = async (id) => {
  return await prisma.services.findUnique({
    where: { ServiceID: id },
  });
};


const createService = async (data) => {
  return await prisma.services.create({ data });
};


const updateService = async (id, data) => {
  return await prisma.services.update({
    where: { ServiceID: id },
    data,
  });
};

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
