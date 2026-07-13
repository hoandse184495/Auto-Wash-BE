import branchService from "../services/branchService.js";

const getAllBranches = async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) {
      filters.Status = req.query.status;
    }
    const includeInactive = req.query.includeInactive === "true";

    const branches = await branchService.getAllBranches(filters, { includeInactive });
    res.status(200).json({
      success: true,
      data: branches,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getBranchById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const branch = await branchService.getBranchById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chi nhánh" });
    }

    res.status(200).json({
      success: true,
      data: branch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createBranch = async (req, res) => {
  try {
    const branch = await branchService.createBranch(req.body);
    res.status(201).json({
      success: true,
      message: "Tạo chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateBranch = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const branch = await branchService.updateBranch(id, req.body);
    res.status(200).json({
      success: true,
      message: "Cập nhật chi nhánh thành công",
      data: branch,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    await branchService.deleteBranch(id);
    res.status(200).json({
      success: true,
      message: "Xoá chi nhánh thành công (Soft delete)",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
