import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

// Các cột trả về (luôn loại bỏ PasswordHash)
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

/**
 * Lấy danh sách users theo filter
 */
const getAllUsers = async (filters = {}) => {
  return await prisma.users.findMany({
    where: filters,
    select: userSelectFields,
    orderBy: { UserID: "asc" },
  });
};

/**
 * Lấy chi tiết 1 user theo ID
 */
const getUserById = async (id) => {
  return await prisma.users.findUnique({
    where: { UserID: id },
    select: userSelectFields,
  });
};

/**
 * Tạo user mới (Staff/Manager)
 * - Kiểm tra trùng Email/Phone
 * - Hash password trước khi lưu
 */
const createUser = async (data) => {
  const { Password, ...rest } = data;

  // Kiểm tra trùng Email
  if (rest.Email) {
    const existingEmail = await prisma.users.findFirst({
      where: { Email: rest.Email },
    });
    if (existingEmail) {
      throw new Error("Email đã tồn tại trong hệ thống");
    }
  }

  // Kiểm tra trùng Phone
  if (rest.Phone) {
    const existingPhone = await prisma.users.findFirst({
      where: { Phone: rest.Phone },
    });
    if (existingPhone) {
      throw new Error("Số điện thoại đã tồn tại trong hệ thống");
    }
  }

  // Hash password
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

/**
 * Cập nhật thông tin user
 * - Nếu đổi password thì hash lại
 */
const updateUser = async (id, data) => {
  const { Password, ...rest } = data;

  // Nếu có đổi password, hash lại
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

/**
 * Soft Delete: chuyển Status thành Inactive
 */
const deleteUser = async (id) => {
  return await prisma.users.update({
    where: { UserID: id },
    data: {
      Status: "Inactive",
      UpdatedAt: new Date(),
    },
    select: userSelectFields,
  });
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
