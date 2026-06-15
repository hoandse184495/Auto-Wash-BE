import userService from "../services/userService.js";

/**
 * GET /api/users
 * Admin: xem toàn bộ (hỗ trợ filter ?Role=...&BranchID=...&Status=...)
 * Manager: chỉ xem Staff cùng chi nhánh
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, branchId } = req.user;
    const filters = {};

    if (role === "Manager") {
      // Manager chỉ thấy Staff cùng chi nhánh
      filters.BranchID = branchId;
      filters.Role = "Staff";
    } else {
      // Admin: áp dụng query params nếu có
      if (req.query.Role) filters.Role = req.query.Role;
      if (req.query.BranchID) filters.BranchID = parseInt(req.query.BranchID);
    }

    // Filter theo Status nếu có
    if (req.query.Status) {
      filters.Status = req.query.Status;
    } else {
      // Mặc định chỉ lấy user Active
      filters.Status = "Active";
    }

    const users = await userService.getAllUsers(filters);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/:id
 * Admin: xem bất kỳ ai
 * Manager: chỉ xem Staff cùng chi nhánh
 */
const getUserById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const user = await userService.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Manager chỉ được xem Staff cùng chi nhánh
    const { role, branchId } = req.user;
    if (role === "Manager") {
      if (user.BranchID !== branchId || user.Role !== "Staff") {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xem thông tin người dùng này" });
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users
 * Admin: tạo Staff/Manager ở bất kỳ chi nhánh nào
 * Manager: chỉ tạo Staff ở chi nhánh của mình
 */
const createUser = async (req, res) => {
  try {
    const { role, branchId } = req.user;
    const data = req.body;

    if (role === "Manager") {
      // Manager không được tạo Admin hoặc Manager
      if (data.Role && data.Role !== "Staff") {
        return res.status(403).json({
          success: false,
          message: "Manager chỉ được phép tạo tài khoản Staff",
        });
      }
      // Ép Role = Staff và BranchID = chi nhánh của Manager
      data.Role = "Staff";
      data.BranchID = branchId;
    }

    const user = await userService.createUser(data);
    res.status(201).json({
      success: true,
      message: "Tạo tài khoản thành công",
      data: user,
    });
  } catch (error) {
    // Bắt lỗi trùng lặp
    if (error.message.includes("đã tồn tại")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/users/:id
 * Admin: sửa bất kỳ ai
 * Manager: chỉ sửa Staff cùng chi nhánh
 */
const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    // Kiểm tra user tồn tại
    const existingUser = await userService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Phân quyền Manager
    const { role, branchId } = req.user;
    if (role === "Manager") {
      if (existingUser.BranchID !== branchId || existingUser.Role !== "Staff") {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được sửa thông tin Staff thuộc chi nhánh của mình",
        });
      }
      // Không cho Manager đổi Role hoặc BranchID
      delete req.body.Role;
      delete req.body.BranchID;
    }

    const user = await userService.updateUser(id, req.body);
    res.json({
      success: true,
      message: "Cập nhật thành công",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/users/:id
 * Soft Delete: chuyển Status thành Inactive
 * Admin: xóa bất kỳ ai
 * Manager: chỉ xóa Staff cùng chi nhánh
 */
const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    // Kiểm tra user tồn tại
    const existingUser = await userService.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Phân quyền Manager
    const { role, branchId } = req.user;
    if (role === "Manager") {
      if (existingUser.BranchID !== branchId || existingUser.Role !== "Staff") {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được xóa Staff thuộc chi nhánh của mình",
        });
      }
    }

    await userService.deleteUser(id);
    res.json({
      success: true,
      message: "Xóa người dùng thành công (Soft delete)",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
