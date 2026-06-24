import prisma from "../config/prisma.js";
import vnpayConfig from "../config/vnpayConfig.js";

const createFromBooking = async (bookingId) => {
  const booking = await prisma.bookingGroups.findUnique({
    where: { BookingGroupID: bookingId },
    include: {
      BookingItems: {
        include: {
          ServiceLineItems: true,
        },
      },
    },
  });

  if (!booking) throw new Error("Không tìm thấy Booking");
  if (booking.Status !== "Completed") {
    throw new Error(
      "Chỉ có thể tạo hóa đơn khi đơn đặt lịch đã hoàn thành (Completed)",
    );
  }

  const existingTransaction = await prisma.transactions.findFirst({
    where: { BookingGroupID: bookingId },
  });

  if (existingTransaction) {
    throw new Error("Giao dịch cho đơn đặt lịch này đã được tạo");
  }

  let subtotal = 0;
  booking.BookingItems.forEach((item) => {
    item.ServiceLineItems.forEach((lineItem) => {
      subtotal += parseFloat(lineItem.LineTotal || 0);
    });
  });

  const discountAmount = 0;
  const finalAmount = subtotal - discountAmount;

  const transaction = await prisma.transactions.create({
    data: {
      BookingGroupID: bookingId,
      CustomerID: booking.CustomerID,
      Subtotal: subtotal,
      DiscountAmount: discountAmount,
      FinalAmount: finalAmount,
      Status: "Pending",
    },
  });

  return transaction;
};

const payManual = async (transactionId, method, staffId) => {
  const validMethods = ["CASH", "BANK_TRANSFER"];
  if (!validMethods.includes(method)) {
    throw new Error(
      "Phương thức thanh toán thủ công chỉ hỗ trợ CASH hoặc BANK_TRANSFER",
    );
  }

  const transaction = await prisma.transactions.findUnique({
    where: { TransactionID: transactionId },
  });

  if (!transaction) throw new Error("Không tìm thấy Giao dịch");
  if (transaction.Status === "Paid") {
    throw new Error("Giao dịch này đã được thanh toán rồi");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedTransaction = await tx.transactions.update({
      where: { TransactionID: transactionId },
      data: { Status: "Paid" },
    });

    await tx.paymentRecords.create({
      data: {
        TransactionID: transactionId,
        Method: method,
        Amount: transaction.FinalAmount,
        Status: "Success",
        ConfirmedBy: staffId,
        ConfirmedAt: new Date(),
      },
    });

    return updatedTransaction;
  });

  return { message: "Xác nhận thanh toán thành công", data: result };
};

const createVNPayUrl = async (transactionId, ipAddr) => {
  const transaction = await prisma.transactions.findUnique({
    where: { TransactionID: transactionId },
  });

  if (!transaction) throw new Error("Không tìm thấy Giao dịch");
  if (transaction.Status !== "Pending") {
    throw new Error("Giao dịch này không ở trạng thái chờ thanh toán");
  }

  const txnRef = `${transactionId}_${Date.now()}`;

  const paymentUrl = vnpayConfig.buildPaymentUrl({
    vnp_Amount: parseFloat(transaction.FinalAmount),
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Thanh toan giao dich ${transactionId} tai AutoWashPro`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: process.env.VNP_RETURN_URL,
  });

  return paymentUrl;
};

const vnpayIPN = async (query) => {
  try {
    const verify = vnpayConfig.verifyIpnCall(query);

    if (!verify.isVerified) {
      return { RspCode: "97", Message: "Invalid signature" };
    }

    const txnRef = query.vnp_TxnRef;
    const transactionId = parseInt(txnRef.split("_")[0]);

    const transaction = await prisma.transactions.findUnique({
      where: { TransactionID: transactionId },
    });

    if (!transaction) {
      return { RspCode: "01", Message: "Order not found" };
    }

    if (transaction.Status === "Paid") {
      return { RspCode: "02", Message: "Order already confirmed" };
    }

    if (!verify.isSuccess) {
      return { RspCode: "00", Message: "Confirm Success" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.transactions.update({
        where: { TransactionID: transactionId },
        data: { Status: "Paid" },
      });

      await tx.paymentRecords.create({
        data: {
          TransactionID: transactionId,
          Method: "VNPAY",
          Amount: transaction.FinalAmount,
          ReferenceCode: query.vnp_TransactionNo,
          Status: "Success",
          ConfirmedAt: new Date(),
        },
      });
    });

    return { RspCode: "00", Message: "Confirm Success" };
  } catch (error) {
    console.error("Lỗi xử lý VNPay IPN:", error);
    return { RspCode: "99", Message: "Unknown error" };
  }
};

const applyDiscount = async (transactionId, promotionId) => {
  const transaction = await prisma.transactions.findUnique({
    where: { TransactionID: transactionId },
    include: { BookingGroups: true }
  });

  if (!transaction) throw new Error("Không tìm thấy hóa đơn");
  if (transaction.Status !== "Pending") {
    throw new Error("Chỉ có thể áp dụng mã giảm giá cho hóa đơn chưa thanh toán");
  }

  const promotion = await prisma.promotions.findUnique({
    where: { PromotionID: promotionId }
  });

  if (!promotion) throw new Error("Mã khuyến mãi không tồn tại");
  if (promotion.Status !== "Active") throw new Error("Mã khuyến mãi đã ngưng hoạt động");

  const now = new Date();
  if (promotion.StartDate && new Date(promotion.StartDate) > now) {
    throw new Error("Mã khuyến mãi chưa tới thời gian áp dụng");
  }
  if (promotion.EndDate && new Date(promotion.EndDate) < now) {
    throw new Error("Mã khuyến mãi đã hết hạn");
  }

  // Nếu Khuyến mãi yêu cầu giới hạn Branch
  if (promotion.BranchID && transaction.BookingGroups?.BranchID !== promotion.BranchID) {
    throw new Error("Mã khuyến mãi không áp dụng cho chi nhánh này");
  }

  // TÍNH TOÁN THEO LOGIC CELLPHONES (Tính giảm giá tuần tự nếu sau này có Hạng thành viên)
  // Bước 1: Giả sử Subtotal là 500k. Ta lấy Subtotal làm Base để trừ khuyến mãi
  let calculatedDiscount = 0;
  const baseAmount = parseFloat(transaction.Subtotal);

  if (promotion.DiscountType === "PERCENTAGE") {
    calculatedDiscount = (baseAmount * parseFloat(promotion.DiscountValue)) / 100;
  } else if (promotion.DiscountType === "FIXED_AMOUNT") {
    calculatedDiscount = parseFloat(promotion.DiscountValue);
  }

  // Không cho phép giảm quá giá trị hóa đơn
  if (calculatedDiscount > baseAmount) {
    calculatedDiscount = baseAmount;
  }

  // Bước 2: Tương lai nếu có Hạng thành viên, ta sẽ trừ tiếp 5% của (baseAmount - calculatedDiscount).
  // Hiện tại chưa có Loyalty -> FinalAmount = baseAmount - calculatedDiscount
  const newFinalAmount = baseAmount - calculatedDiscount;

  // Thực thi Transaction DB
  const result = await prisma.$transaction(async (tx) => {
    // Xóa khuyến mãi cũ nếu đã áp dụng (Mỗi hóa đơn chỉ xài 1 mã promotion)
    await tx.transactionDiscounts.deleteMany({
      where: {
        BookingGroupID: transaction.BookingGroupID,
        DiscountType: 'PROMOTION'
      }
    });

    // Cập nhật lại Hóa đơn
    const updatedTx = await tx.transactions.update({
      where: { TransactionID: transactionId },
      data: {
        DiscountAmount: calculatedDiscount,
        FinalAmount: newFinalAmount
      }
    });

    // Ghi log vào TransactionDiscounts
    await tx.transactionDiscounts.create({
      data: {
        BookingGroupID: transaction.BookingGroupID,
        CustomerID: transaction.CustomerID,
        PromotionID: promotionId,
        DiscountType: 'PROMOTION',
        DiscountAmount: calculatedDiscount,
        DiscountName: promotion.PromotionName
      }
    });

    return updatedTx;
  });

  return result;
};

export default {
  createFromBooking,
  payManual,
  createVNPayUrl,
  vnpayIPN,
  applyDiscount,
};
