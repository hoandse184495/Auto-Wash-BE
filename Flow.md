# Luồng hoạt động (Flow Analysis)

Tài liệu này phân tích chi tiết luồng nghiệp vụ của hệ thống Auto Wash Pro Backend.

## 1. Luồng Xác thực và Phân quyền (Auth & RBAC)
1. **Đăng nhập (`/api/auth/login`)**: Khách hàng hoặc Nhân viên truyền `email` & `password`. Hệ thống kiểm tra DB, so khớp hash `bcrypt`, nếu đúng trả về JWT chứa: `{ userId, role, branchId }`.
2. **Xác thực (`authMiddleware`)**: Mọi request tới API cần bảo mật đều phải đính kèm Header `Authorization: Bearer <token>`. Middleware giải mã token và gán vào `req.user`.
3. **Phân quyền (`roleMiddleware`)**: Dựa vào `req.user.role`, hệ thống quyết định:
   - `Admin`: Quyền tối cao toàn hệ thống.
   - `Manager`: Quyền quản trị ở cấp độ Chi nhánh (chỉ lấy/thao tác trên data có `BranchID` của họ).
   - `Staff`: Xem công việc, lịch làm việc của mình.
   - `Customer`: Xem danh sách dịch vụ, đặt lịch, xem lịch sử của mình.

---

## 2. Luồng Quản lý Chi nhánh (Branches)
- **Quản trị**: `Admin` tạo/sửa/xoá mềm (`Status = Inactive`) chi nhánh thông qua `/api/branches`.
- **Public**: Hệ thống cung cấp API GET `/api/branches` để khách hàng chọn chi nhánh họ muốn rửa xe.

---

## 3. Luồng Quản lý Dịch vụ Gốc (Services Master Data)
- **Quản trị**: `Admin` định nghĩa các dịch vụ cơ bản của hệ thống tại `/api/services` (VD: Rửa bọt tuyết, Phủ Ceramic). Mỗi dịch vụ có `BasePrice` (giá gốc).
- **Public**: Khách hàng có thể lấy danh sách các dịch vụ đang `Active`.

---

## 4. Luồng Cấu hình Dịch vụ theo Chi nhánh (BranchServices)
Đây là cốt lõi để tuỳ biến menu dịch vụ theo từng nơi:
- **Gán Dịch Vụ**: `Admin` (toàn hệ thống) hoặc `Manager` (tại chi nhánh của mình) gán một dịch vụ gốc vào chi nhánh thông qua bảng trung gian `BranchServices` (`/api/branch-services`).
- **Ghi đè giá (Price Override)**: Mỗi chi nhánh có thể cấu hình giá bán riêng (`PriceOverride`) cho cùng một dịch vụ gốc. Nếu không set, hệ thống tự lấy `BasePrice`.
- **Hiển thị cho Khách Hàng**:
  Khách hàng gọi GET `/api/branches/:branchId/services`. API này tự động `JOIN` bảng `BranchServices` và `Services`, thực hiện kiểm tra 2 lớp:
  1. Chỉ lấy những bản ghi mà cả `BranchServices.Status` và `Services.Status` đều đang `Active`. (Ví dụ: Nếu Admin ngừng cung cấp dịch vụ Phủ Ceramic trên toàn hệ thống, tự động mọi chi nhánh sẽ ẩn dịch vụ đó).
  2. Tự động tính toán cột `ActualPrice` (Nếu `PriceOverride != null` thì dùng giá riêng, ngược lại dùng `BasePrice`).
  Khách hàng dùng danh sách và giá thực tế này để quyết định đặt lịch.

---

*(Tài liệu này sẽ tiếp tục được mở rộng khi tích hợp tính năng Booking, Scheduling và Thanh Toán)*
