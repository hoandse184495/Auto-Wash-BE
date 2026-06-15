import branchServiceService from "../services/branchServiceService.js";

// ==========================================
// API PUBLIC (Dành cho khách hàng)
// ==========================================

/**
 * GET /api/branches/:branchId/services
 * Công khai: Trả về danh sách dịch vụ của 1 chi nhánh kèm ActualPrice
 */
const getPublicServicesByBranch = async (req, res) => {
  try {
    const branchId = parseInt(req.params.branchId);
    if (isNaN(branchId)) {
      return res.status(400).json({ success: false, message: "BranchID không hợp lệ" });
    }

    const services = await branchServiceService.getPublicByBranch(branchId);
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// API PRIVATE (Dành cho Admin/Manager)
// ==========================================

/**
 * GET /api/branch-services?BranchID=...
 */
const getAll = async (req, res) => {
  try {
    let branchId = parseInt(req.query.BranchID);
    const { role, branchId: userBranchId } = req.user;

    // Manager bắt buộc xem của chi nhánh mình
    if (role === "Manager") {
      branchId = userBranchId;
    }

    if (!branchId || isNaN(branchId)) {
      return res.status(400).json({ success: false, message: "Yêu cầu cung cấp BranchID hợp lệ" });
    }

    const filters = {};
    if (req.query.Status) filters.Status = req.query.Status;

    const list = await branchServiceService.getByBranch(branchId, filters);
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/branch-services/:id
 */
const getById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await branchServiceService.getById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    }

    // Manager chỉ được xem nếu thuộc chi nhánh của mình
    if (req.user.role === "Manager" && record.BranchID !== req.user.branchId) {
      return res.status(403).json({ success: false, message: "Không có quyền xem chi nhánh này" });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/branch-services
 */
const create = async (req, res) => {
  try {
    const { BranchID } = req.body;
    
    // Manager chỉ được gán cho chi nhánh của mình
    if (req.user.role === "Manager" && BranchID !== req.user.branchId) {
      return res.status(403).json({ success: false, message: "Chỉ được gán dịch vụ cho chi nhánh của mình" });
    }

    const record = await branchServiceService.create(req.body);
    res.status(201).json({ success: true, message: "Gán dịch vụ thành công", data: record });
  } catch (error) {
    if (error.message.includes("tồn tại") || error.message.includes("đã được gán")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/branch-services/:id
 */
const update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await branchServiceService.getById(id);
    
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    // Manager phân quyền
    if (req.user.role === "Manager" && existing.BranchID !== req.user.branchId) {
      return res.status(403).json({ success: false, message: "Không có quyền" });
    }

    // Không cho đổi BranchID hoặc ServiceID ở PUT
    delete req.body.BranchID;
    delete req.body.ServiceID;

    const record = await branchServiceService.update(id, req.body);
    res.json({ success: true, message: "Cập nhật thành công", data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/branch-services/:id
 */
const deleteSoft = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await branchServiceService.getById(id);
    
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    // Manager phân quyền
    if (req.user.role === "Manager" && existing.BranchID !== req.user.branchId) {
      return res.status(403).json({ success: false, message: "Không có quyền" });
    }

    await branchServiceService.deleteSoft(id);
    res.json({ success: true, message: "Xóa thành công (Soft delete)" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getPublicServicesByBranch,
  getAll,
  getById,
  create,
  update,
  deleteSoft,
};
