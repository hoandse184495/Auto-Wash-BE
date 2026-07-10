import express from "express";
import { z } from "zod/v4";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import serviceController from "../controllers/serviceController.js";

const router = express.Router();

// === Zod Schemas ===
const createServiceSchema = z.object({
  ServiceName: z.string().min(1, "Tên dịch vụ không được để trống"),
  BasePrice: z.number().positive("Giá phải lớn hơn 0"),
  Description: z.string().optional(),
  DurationMinutes: z.number().int().positive().optional(),
  Type: z.string().optional(),
  Status: z.enum(["Active", "Inactive"]).optional(),
});

const updateServiceSchema = z.object({
  ServiceName: z.string().min(1).optional(),
  BasePrice: z.number().positive().optional(),
  Description: z.string().optional(),
  DurationMinutes: z.number().int().positive().optional(),
  Type: z.string().optional(),
  Status: z.enum(["Active", "Inactive"]).optional(),
});

// === Routes ===

/**
 * @openapi
 * /api/services:
 *   get:
 *     summary: Lấy danh sách dịch vụ
 *     description: API công khai, ai cũng có thể xem danh sách dịch vụ.
 *     tags: [Quản lý Dịch vụ]
 *     parameters:
 *       - in: query
 *         name: Status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: Type
 *         schema:
 *           type: string
 *         description: Lọc theo loại dịch vụ
 *     responses:
 *       200:
 *         description: Danh sách dịch vụ
 */
router.get("/", serviceController.getAllServices);

/**
 * @openapi
 * /api/services/{id}:
 *   get:
 *     summary: Lấy chi tiết dịch vụ theo ID
 *     tags: [Quản lý Dịch vụ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết dịch vụ
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", serviceController.getServiceById);

/**
 * @openapi
 * /api/services:
 *   post:
 *     summary: Tạo dịch vụ mới (Admin only)
 *     tags: [Quản lý Dịch vụ]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ServiceName
 *               - BasePrice
 *             properties:
 *               ServiceName:
 *                 type: string
 *                 example: Rửa xe bọt tuyết
 *               BasePrice:
 *                 type: number
 *                 example: 150000
 *               Description:
 *                 type: string
 *                 example: Rửa xe bằng bọt tuyết cao cấp, làm sạch sâu
 *               DurationMinutes:
 *                 type: integer
 *                 example: 30
 *               Type:
 *                 type: string
 *                 example: Rửa xe
 *     responses:
 *       201:
 *         description: Tạo dịch vụ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["Admin"]),
  validate(createServiceSchema),
  serviceController.createService
);

/**
 * @openapi
 * /api/services/{id}:
 *   put:
 *     summary: Cập nhật dịch vụ (Admin only)
 *     tags: [Quản lý Dịch vụ]
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
 *             properties:
 *               ServiceName:
 *                 type: string
 *               BasePrice:
 *                 type: number
 *               Description:
 *                 type: string
 *               DurationMinutes:
 *                 type: integer
 *               Type:
 *                 type: string
 *               Status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin"]),
  validate(updateServiceSchema),
  serviceController.updateService
);

/**
 * @openapi
 * /api/services/{id}:
 *   delete:
 *     summary: Xóa dịch vụ (Soft Delete, Admin only)
 *     tags: [Quản lý Dịch vụ]
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
 *         description: Xóa thành công (Soft delete)
 *       404:
 *         description: Không tìm thấy
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin"]),
  serviceController.deleteService
);

export default router;
