import vehicleService from "../services/vehicleService.js";

/**
 * GET /api/vehicles
 */
const getAllVehicles = async (req, res) => {
  try {
    const filters = {};
    const { role, userId } = req.user;

    // Chỉ lấy xe đang Active mặc định
    if (req.query.Status) {
      filters.Status = req.query.Status;
    } else if (role !== "Admin") {
      filters.Status = "Active"; // Admin có thể xem Inactive, Customer chỉ xem Active
    }

    if (role === "Customer") {
      // Customer: Ép lấy CustomerID của chính họ
      filters.CustomerID = await vehicleService.getOrCreateCustomer(userId);
    } else if (role === "Admin" && req.query.CustomerID) {
      // Admin: Hỗ trợ filter theo CustomerID nếu muốn
      filters.CustomerID = parseInt(req.query.CustomerID);
    }

    const vehicles = await vehicleService.getAll(filters);
    res.json({ success: true, data: vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/vehicles/:id
 */
const getVehicleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const vehicle = await vehicleService.getById(id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Không tìm thấy xe" });
    }

    const { role, userId } = req.user;
    if (role === "Customer") {
      const customerId = await vehicleService.getOrCreateCustomer(userId);
      if (vehicle.CustomerID !== customerId || vehicle.Status === "Inactive") {
        return res.status(403).json({ success: false, message: "Bạn không có quyền truy cập xe này" });
      }
    }

    res.json({ success: true, data: vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/vehicles
 */
const createVehicle = async (req, res) => {
  try {
    const data = req.body;
    const { role, userId } = req.user;

    if (role === "Customer") {
      // Ép CustomerID của chính người dùng
      data.CustomerID = await vehicleService.getOrCreateCustomer(userId);
    } else {
      // Admin tạo xe cho khách -> phải truyền CustomerID
      if (!data.CustomerID) {
        return res.status(400).json({ success: false, message: "Yêu cầu CustomerID" });
      }
    }

    const vehicle = await vehicleService.create(data);
    res.status(201).json({ success: true, message: "Thêm xe thành công", data: vehicle });
  } catch (error) {
    if (error.message.includes("trùng")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/vehicles/:id
 */
const updateVehicle = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await vehicleService.getById(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy xe" });
    }

    const { role, userId } = req.user;
    if (role === "Customer") {
      const customerId = await vehicleService.getOrCreateCustomer(userId);
      if (existing.CustomerID !== customerId || existing.Status === "Inactive") {
        return res.status(403).json({ success: false, message: "Bạn không có quyền sửa xe này" });
      }
      // Không cho phép Customer đổi CustomerID hoặc Status
      delete req.body.CustomerID;
      delete req.body.Status;
    }

    const vehicle = await vehicleService.update(id, req.body);
    res.json({ success: true, message: "Cập nhật thành công", data: vehicle });
  } catch (error) {
    if (error.message.includes("trùng")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/vehicles/:id
 */
const deleteVehicle = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await vehicleService.getById(id);

    if (!existing || existing.Status === "Inactive") {
      return res.status(404).json({ success: false, message: "Không tìm thấy xe" });
    }

    const { role, userId } = req.user;
    if (role === "Customer") {
      const customerId = await vehicleService.getOrCreateCustomer(userId);
      if (existing.CustomerID !== customerId) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xóa xe này" });
      }
    }

    await vehicleService.deleteSoft(id);
    res.json({ success: true, message: "Đã xóa xe (Soft delete)" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
