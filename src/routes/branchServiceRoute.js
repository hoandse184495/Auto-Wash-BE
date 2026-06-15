import express from "express";
import { z } from "zod/v4";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import branchServiceController from "../controllers/branchServiceController.js";

const router = express.Router();

// === Zod Schemas ===
const createSchema = z.object({
  BranchID: z.number().int().positive("BranchID phải lớn hơn 0"),
  ServiceID: z.number().int().positive("ServiceID phải lớn hơn 0"),
  PriceOverride: z.number().positive("Giá override phải lớn hơn 0").nullable().optional(),
  Status: z.enum(["Active", "Inactive"]).optional(),
});

const updateSchema = z.object({
  PriceOverride: z.number().positive().nullable().optional(),
  Status: z.enum(["Active", "Inactive"]).optional(),
});

// === ROUTES (Admin / Manager) ===

/**
 * @openapi
 * /api/branch-services:
 *   get:
 *     summary: (Admin/Manager) Lấy danh sách dịch vụ đã gán
 *     tags: ["Gán Dịch vụ"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: BranchID
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  branchServiceController.getAll
);

/**
 * @openapi
 * /api/branch-services/{id}:
 *   get:
 *     summary: (Admin/Manager) Xem chi tiết
 *     tags: ["Gán Dịch vụ"]
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
 *         description: Thành công
 */
router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  branchServiceController.getById
);

/**
 * @openapi
 * /api/branch-services:
 *   post:
 *     summary: (Admin/Manager) Gán dịch vụ cho chi nhánh
 *     tags: ["Gán Dịch vụ"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - BranchID
 *               - ServiceID
 *             properties:
 *               BranchID:
 *                 type: integer
 *                 example: 1
 *               ServiceID:
 *                 type: integer
 *                 example: 1
 *               PriceOverride:
 *                 type: number
 *                 example: 120000
 *               Status:
 *                 type: string
 *                 enum: [Active, Inactive]
 *                 example: Active
 *     responses:
 *       201:
 *         description: Thành công
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  validate(createSchema),
  branchServiceController.create
);

/**
 * @openapi
 * /api/branch-services/{id}:
 *   put:
 *     summary: (Admin/Manager) Cập nhật giá/trạng thái
 *     tags: ["Gán Dịch vụ"]
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
 *               PriceOverride:
 *                 type: number
 *                 example: 130000
 *               Status:
 *                 type: string
 *                 enum: [Active, Inactive]
 *                 example: Active
 *     responses:
 *       200:
 *         description: Thành công
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  validate(updateSchema),
  branchServiceController.update
);

/**
 * @openapi
 * /api/branch-services/{id}:
 *   delete:
 *     summary: (Admin/Manager) Xóa (Soft Delete)
 *     tags: ["Gán Dịch vụ"]
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
 *         description: Thành công
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  branchServiceController.deleteSoft
);

export default router;
