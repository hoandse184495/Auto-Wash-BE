const roleMiddleware = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa xác thực" });
    }

    const currentRole = String(req.user.role || "").trim().toLowerCase();
    const normalizedRequiredRoles = requiredRoles.map((role) => String(role || "").trim().toLowerCase());

    if (!normalizedRequiredRoles.includes(currentRole)) {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }

    next();
  };
};

export default roleMiddleware;
