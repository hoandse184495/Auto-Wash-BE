import express from "express";
import promotionController from "../controllers/promotionController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Public: Xem khuyến mãi đang chạy
router.get("/active", promotionController.getActivePromotions);

// Admin / Manager quản lý
router.get("/", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.getAllPromotions);
router.get("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.getPromotionById);
router.post("/", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.createPromotion);
router.put("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.updatePromotion);
router.delete("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.deletePromotion);

export default router;
