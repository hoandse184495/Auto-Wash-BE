import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";


const userSelectFields = {
  UserID: true,
  FullName: true,
  Phone: true,
  Email: true,
  BranchID: true,
  Role: true,
  Status: true,
  CreatedAt: true,
  UpdatedAt: true,
  branches: {
    select: {
      BranchID: true,
      BranchName: true,
    },
  },
};


const getAllUsers = async (filters = {}) => {
  return await prisma.users.findMany({
    where: filters,
    select: userSelectFields,
    orderBy: { UserID: "asc" },
  });
};


const getUserById = async (id) => {
  return await prisma.users.findUnique({
    where: { UserID: id },
    select: userSelectFields,
  });
};


const createUser = async (data) => {
  const { Password, ...rest } = data;


  if (rest.Email) {
    const existingEmail = await prisma.users.findFirst({
      where: { Email: rest.Email },
    });
    if (existingEmail) {
      throw new Error("Email đã tồn tại trong hệ thống");
    }
  }


  if (rest.Phone) {
    const existingPhone = await prisma.users.findFirst({
      where: { Phone: rest.Phone },
    });
    if (existingPhone) {
      throw new Error("Số điện thoại đã tồn tại trong hệ thống");
    }
  }


  const PasswordHash = await bcrypt.hash(Password, 10);

  const user = await prisma.users.create({
    data: {
      ...rest,
      PasswordHash,
    },
    select: userSelectFields,
  });

  return user;
};


const updateUser = async (id, data) => {
  const { Password, ...rest } = data;


  if (Password) {
    rest.PasswordHash = await bcrypt.hash(Password, 10);
  }

  rest.UpdatedAt = new Date();

  return await prisma.users.update({
    where: { UserID: id },
    data: rest,
    select: userSelectFields,
  });
};

const deleteUser = async (id) => {
  return await prisma.$transaction(async (tx) => {
    await tx.staffSchedules.updateMany({
      where: {
        UserID: id,
        Status: "Active",
      },
      data: {
        Status: "Inactive",
      },
    });

    return await tx.users.update({
      where: { UserID: id },
      data: {
        Status: "Inactive",
        UpdatedAt: new Date(),
      },
      select: userSelectFields,
    });
  });
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
