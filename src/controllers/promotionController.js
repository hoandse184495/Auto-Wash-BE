import promotionService from "../services/promotionService.js";

const getAllPromotions = async (req, res) => {
  try {
    const { branchId, role } = req.user;
    const data = await promotionService.getAllPromotions(branchId, role);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getActivePromotions = async (req, res) => {
  try {
    const data = await promotionService.getActivePromotions();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPromotionById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await promotionService.getPromotionById(id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

const createPromotion = async (req, res) => {
  try {
    const data = await promotionService.createPromotion(req.body);
    res.status(201).json({ success: true, message: "Tạo thành công", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updatePromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await promotionService.updatePromotion(id, req.body);
    res.json({ success: true, message: "Cập nhật thành công", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await promotionService.deletePromotion(id);
    res.json({ success: true, message: "Xóa thành công" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export default {
  getAllPromotions,
  getActivePromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion
};
