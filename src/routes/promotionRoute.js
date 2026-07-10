import express from "express";
import promotionController from "../controllers/promotionController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";

const router = express.Router();

/**
 * @openapi
 * /api/promotions/active:
 *   get:
 *     summary: Lấy danh sách Khuyến mãi đang chạy (Public/Customer)
 *     tags: ["Khuyến mãi"]
 *     responses:
 *       200:
 *         description: Trả về danh sách khuyến mãi đang Active và còn hạn
 */
router.get("/active", promotionController.getActivePromotions);

/**
 * @openapi
 * /api/promotions:
 *   get:
 *     summary: Lấy danh sách tất cả Khuyến mãi (Admin/Manager)
 *     tags: ["Khuyến mãi"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách khuyến mãi
 *   post:
 *     summary: Tạo Khuyến mãi mới (Admin/Manager)
 *     tags: ["Khuyến mãi"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               PromotionName:
 *                 type: string
 *               DiscountType:
 *                 type: string
 *                 enum: [PERCENTAGE, FIXED_AMOUNT]
 *               DiscountValue:
 *                 type: number
 *               StartDate:
 *                 type: string
 *                 format: date-time
 *               EndDate:
 *                 type: string
 *                 format: date-time
 *               UsageLimit:
 *                 type: integer
 *               BranchID:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.get("/", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.getAllPromotions);
router.post("/", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.createPromotion);

/**
 * @openapi
 * /api/promotions/{id}:
 *   get:
 *     summary: Lấy thông tin 1 Khuyến mãi (Admin/Manager)
 *     tags: ["Khuyến mãi"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trả về thông tin khuyến mãi
 *   put:
 *     summary: Cập nhật Khuyến mãi (Admin/Manager)
 *     tags: ["Khuyến mãi"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     summary: Tạm ngưng/Xóa mềm Khuyến mãi (Admin/Manager)
 *     tags: ["Khuyến mãi"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.get("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.getPromotionById);
router.put("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.updatePromotion);
router.delete("/:id", authMiddleware, roleMiddleware(["Admin", "Manager"]), promotionController.deletePromotion);

export default router;
