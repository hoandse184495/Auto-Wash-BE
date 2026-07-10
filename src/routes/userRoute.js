import express from "express";
import { z } from "zod/v4";
import authMiddleware from "../middlewares/authMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import validate from "../middlewares/validateMiddleware.js";
import userController from "../controllers/userController.js";

const router = express.Router();

// === Zod Schemas ===
const createUserSchema = z.object({
  FullName: z.string().min(1, "Tên không được để trống"),
  Password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên"),
  Role: z.enum(["Staff", "Manager", "Admin"]).default("Staff"),
  Phone: z.string().optional(),
  Email: z.string().email("Email không hợp lệ").optional(),
  BranchID: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  FullName: z.string().min(1).optional(),
  Password: z.string().min(6).optional(),
  Phone: z.string().optional(),
  Email: z.string().email().optional(),
  Role: z.enum(["Staff", "Manager", "Admin"]).optional(),
  BranchID: z.number().int().positive().nullable().optional(),
  Status: z.enum(["Active", "Inactive"]).optional(),
});

// === Routes ===

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     description: |
 *       - Admin: Xem toàn bộ hệ thống, hỗ trợ filter theo Role, BranchID, Status.
 *       - Manager: Chỉ thấy Staff cùng chi nhánh.
 *     tags: [Quản lý Người dùng]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: Role
 *         schema:
 *           type: string
 *           enum: [Customer, Staff, Manager, Admin]
 *         description: Lọc theo vai trò (chỉ Admin dùng được)
 *       - in: query
 *         name: BranchID
 *         schema:
 *           type: integer
 *         description: Lọc theo chi nhánh (chỉ Admin dùng được)
 *       - in: query
 *         name: Status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Lọc theo trạng thái (mặc định Active)
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 */
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  userController.getAllUsers
);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Lấy chi tiết người dùng theo ID
 *     tags: [Quản lý Người dùng]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID người dùng
 *     responses:
 *       200:
 *         description: Thông tin chi tiết người dùng
 *       403:
 *         description: Không có quyền xem
 *       404:
 *         description: Không tìm thấy
 */
router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  userController.getUserById
);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Tạo tài khoản nội bộ (Staff/Manager)
 *     description: |
 *       - Admin: Tạo Staff hoặc Manager cho bất kỳ chi nhánh nào.
 *       - Manager: Chỉ tạo Staff cho chi nhánh của mình.
 *     tags: [Quản lý Người dùng]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - FullName
 *               - Password
 *               - Role
 *             properties:
 *               FullName:
 *                 type: string
 *                 example: Trần Văn B
 *               Password:
 *                 type: string
 *                 example: "staff123"
 *               Role:
 *                 type: string
 *                 enum: [Staff, Manager, Admin]
 *                 example: Staff
 *               Phone:
 *                 type: string
 *                 example: "0901234567"
 *               Email:
 *                 type: string
 *                 example: staff_b@autowash.vn
 *               BranchID:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc trùng lặp
 *       403:
 *         description: Không có quyền tạo Role này
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  validate(createUserSchema),
  userController.createUser
);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Cập nhật thông tin người dùng
 *     description: |
 *       - Admin: Sửa bất kỳ ai.
 *       - Manager: Chỉ sửa Staff cùng chi nhánh, không đổi được Role/BranchID.
 *     tags: [Quản lý Người dùng]
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
 *               FullName:
 *                 type: string
 *               Password:
 *                 type: string
 *               Phone:
 *                 type: string
 *               Email:
 *                 type: string
 *               Role:
 *                 type: string
 *               BranchID:
 *                 type: integer
 *               Status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền sửa
 *       404:
 *         description: Không tìm thấy
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  validate(updateUserSchema),
  userController.updateUser
);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Xóa người dùng (Soft Delete → Status = Inactive)
 *     description: |
 *       - Admin: Xóa bất kỳ ai.
 *       - Manager: Chỉ xóa Staff cùng chi nhánh.
 *     tags: [Quản lý Người dùng]
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
 *       403:
 *         description: Không có quyền xóa
 *       404:
 *         description: Không tìm thấy
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["Admin", "Manager"]),
  userController.deleteUser
);

export default router;
