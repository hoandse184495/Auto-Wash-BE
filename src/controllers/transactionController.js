import transactionService from "../services/transactionService.js";

const getAll = async (req, res) => {
  try {
    const branchId = req.query.branchId ? parseInt(req.query.branchId) : undefined;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const allowedStatuses = ["Pending", "Paid", "Cancelled"];

    if (req.query.branchId && (!branchId || branchId < 1)) {
      return res.status(400).json({ success: false, message: "branchId không hợp lệ" });
    }

    if (req.query.status && !allowedStatuses.includes(req.query.status)) {
      return res.status(400).json({ success: false, message: "Trạng thái giao dịch không hợp lệ" });
    }

    if ((req.query.from && !datePattern.test(req.query.from)) || (req.query.to && !datePattern.test(req.query.to))) {
      return res.status(400).json({ success: false, message: "Ngày phải có định dạng YYYY-MM-DD" });
    }

    if (req.query.from && req.query.to && req.query.from > req.query.to) {
      return res.status(400).json({ success: false, message: "Ngày bắt đầu không được sau ngày kết thúc" });
    }

    const data = await transactionService.getAll({
      branchId,
      status: req.query.status || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      search: req.query.search?.trim() || undefined,
      page,
      limit,
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createFromBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: "BookingID không hợp lệ" });
    }

    const transaction = await transactionService.createFromBooking(bookingId);
    res.status(201).json({
      message: "Tạo hóa đơn tạm tính thành công",
      data: transaction,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const payManual = async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { method } = req.body;
    const staffId = req.user.userId;

    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "TransactionID không hợp lệ" });
    }
    if (!method) {
      return res
        .status(400)
        .json({ error: "Thiếu trường method (CASH hoặc BANK_TRANSFER)" });
    }

    const result = await transactionService.payManual(
      transactionId,
      method,
      staffId,
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createVNPayUrl = async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "TransactionID không hợp lệ" });
    }

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress ||
      "127.0.0.1";

    const paymentUrl = await transactionService.createVNPayUrl(
      transactionId,
      ipAddr,
    );

    res.status(200).json({
      message: "Tạo URL VNPay thành công",
      data: { url: paymentUrl },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const vnpayReturn = (req, res) => {
  const { vnp_ResponseCode } = req.query;
  if (vnp_ResponseCode === "00") {
    res.send("<h1>Thanh toán thành công! Bạn có thể tắt tab này.</h1>");
  } else {
    res.send(
      `<h1>Thanh toán thất bại hoặc đã bị hủy (Mã lỗi: ${vnp_ResponseCode})</h1>`,
    );
  }
};

const vnpayIPN = async (req, res) => {
  const query = req.query;
  const result = await transactionService.vnpayIPN(query);

  res.status(200).json(result);
};

const applyDiscount = async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { promotionId } = req.body;

    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "TransactionID không hợp lệ" });
    }
    if (!promotionId) {
      return res.status(400).json({ error: "Vui lòng truyền promotionId" });
    }

    const result = await transactionService.applyDiscount(transactionId, promotionId);
    res.status(200).json({
      message: "Áp dụng khuyến mãi thành công",
      data: result,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const applyReward = async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { redemptionId } = req.body;

    if (!redemptionId) {
      return res.status(400).json({ error: "redemptionId là bắt buộc" });
    }

    const result = await transactionService.applyReward(transactionId, redemptionId);
    res.json({ message: "Áp dụng điểm thưởng thành công", data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export default {
  getAll,
  createFromBooking,
  payManual,
  createVNPayUrl,
  vnpayReturn,
  vnpayIPN,
  applyDiscount,
  applyReward,
};
