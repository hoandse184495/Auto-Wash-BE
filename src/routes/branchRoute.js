import express from "express";
import { z } from "zod";
import branchController from "../controllers/branchController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import validateMiddleware from "../middlewares/validateMiddleware.js";
import branchServiceController from "../controllers/branchServiceController.js";

const router = express.Router();

// Schema validation cho Branch
const branchSchema = z.object({
  BranchName: z.string({ required_error: "Tên chi nhánh là bắt buộc" }).min(1, "Tên chi nhánh không được để trống"),
  Address: z.string().nullable().optional(),
  Phone: z.string().nullable().optional(),
  OpenTime: z.any().optional(), // Prisma DateTime field
  CloseTime: z.any().optional(), // Prisma DateTime field
  BankAccount: z.string().nullable().optional(),
  Status: z.enum(["Active", "Inactive"]).nullable().optional(),
});

/**
 * @openapi
 * /api/branches:
 *   get:
 *     summary: Lấy danh sách chi nhánh
 *     tags: ["Chi nhánh"]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Lọc theo trạng thái. Mặc định ẩn các chi nhánh Inactive (soft-deleted).
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 */
router.get("/", branchController.getAllBranches);

/**
 * @openapi
 * /api/branches/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một chi nhánh
 *     tags: ["Chi nhánh"]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy thông tin chi nhánh thành công
 *       404:
 *         description: Không tìm thấy chi nhánh
 */
router.get("/:id", branchController.getBranchById);

/**
 * @openapi
 * /api/branches/{branchId}/services:
 *   get:
 *     summary: Lấy danh sách dịch vụ của một chi nhánh (Public)
 *     tags: ["Chi nhánh"]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trả về danh sách dịch vụ kèm giá thực tế
 */
router.get("/:branchId/services", branchServiceController.getPublicServicesByBranch);

/**
 * @openapi
 * /api/branches:
 *   post:
 *     summary: Tạo mới chi nhánh
 *     tags: ["Chi nhánh"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - BranchName
 *             properties:
 *               BranchName:
 *                 type: string
 *                 example: Chi nhánh Quận 1
 *               Address:
 *                 type: string
 *                 example: 123 Lê Lợi, Q1, HCM
 *               Phone:
 *                 type: string
 *                 example: 0123456789
 *               Status:
 *                 type: string
 *                 example: Active
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["Admin"]),
  validateMiddleware(branchSchema),
  branchController.createBranch
);

/**
 * @openapi
 * /api/branches/{id}:
 *   put:
 *     summary: Cập nhật chi nhánh
 *     tags: ["Chi nhánh"]
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
 *               BranchName:
 *                 type: string
 *                 example: Chi nhánh Quận 1 (Sửa)
 *               Status:
 *                 type: string
 *                 example: Inactive
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin"]),
  validateMiddleware(branchSchema.partial()), // Cho phép update một phần
  branchController.updateBranch
);

/**
 * @openapi
 * /api/branches/{id}:
 *   delete:
 *     summary: Xoá chi nhánh (Soft delete)
 *     tags: ["Chi nhánh"]
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
 *         description: Xoá thành công
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin"]),
  branchController.deleteBranch
);

export default router;
