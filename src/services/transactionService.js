import prisma from "../config/prisma.js";
import vnpayConfig from "../config/vnpayConfig.js";

const pointToMoneyRate = parseInt(process.env.POINT_TO_MONEY_RATE) || 200;

const getAll = async ({
  branchId,
  status,
  from,
  to,
  search,
  page = 1,
  limit = 20,
}) => {
  const where = {};

  if (branchId) {
    where.BookingGroups = { BranchID: branchId };
  }

  if (status) {
    where.Status = status;
  }

  if (from || to) {
    where.CreatedAt = {};
    if (from) where.CreatedAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      const endExclusive = new Date(`${to}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      where.CreatedAt.lt = endExclusive;
    }
  }

  if (search) {
    const numericSearch = Number(search);
    where.OR = [
      ...(Number.isInteger(numericSearch) && numericSearch > 0
        ? [{ TransactionID: numericSearch }]
        : []),
      { BookingGroups: { is: { BookingCode: { contains: search } } } },
      { Customers: { is: { Users: { is: { FullName: { contains: search } } } } } },
      { Customers: { is: { Users: { is: { Phone: { contains: search } } } } } },
    ];
  }

  const paidWhere = status
    ? status === "Paid"
      ? where
      : { ...where, TransactionID: -1 }
    : { ...where, Status: "Paid" };
  const [rows, totalItems, paidCount, paidAmount] = await prisma.$transaction([
    prisma.transactions.findMany({
      where,
      include: {
        BookingGroups: {
          select: {
            BookingCode: true,
            BranchID: true,
            branches: { select: { BranchName: true } },
          },
        },
        Customers: {
          select: {
            Users: { select: { FullName: true, Phone: true } },
          },
        },
        PaymentRecords: {
          orderBy: { ConfirmedAt: "desc" },
          take: 1,
          select: {
            Method: true,
            Status: true,
            ConfirmedAt: true,
            ReferenceCode: true,
            Users: { select: { FullName: true } },
          },
        },
      },
      orderBy: [{ CreatedAt: "desc" }, { TransactionID: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transactions.count({ where }),
    prisma.transactions.count({ where: paidWhere }),
    prisma.transactions.aggregate({
      where: paidWhere,
      _sum: { FinalAmount: true },
    }),
  ]);

  const items = rows.map((transaction) => {
    const payment = transaction.PaymentRecords[0] || null;
    return {
      TransactionID: transaction.TransactionID,
      BookingGroupID: transaction.BookingGroupID,
      BookingCode: transaction.BookingGroups?.BookingCode || null,
      CustomerID: transaction.CustomerID,
      CustomerName: transaction.Customers?.Users?.FullName || null,
      CustomerPhone: transaction.Customers?.Users?.Phone || null,
      BranchID: transaction.BookingGroups?.BranchID || null,
      BranchName: transaction.BookingGroups?.branches?.BranchName || null,
      Subtotal: transaction.Subtotal,
      DiscountAmount: transaction.DiscountAmount,
      FinalAmount: transaction.FinalAmount,
      Status: transaction.Status,
      PaymentMethod: payment?.Method || null,
      PaymentStatus: payment?.Status || null,
      PaymentReference: payment?.ReferenceCode || null,
      ConfirmedBy: payment?.Users?.FullName || null,
      CreatedAt: transaction.CreatedAt,
      PaidAt: payment?.ConfirmedAt || null,
    };
  });

  return {
    items,
    summary: {
      totalTransactions: totalItems,
      paidTransactions: paidCount,
      totalPaidAmount: paidAmount._sum.FinalAmount || 0,
    },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    },
  };
};

const getRequestedPointsByBooking = async (tx, bookingGroupId) => {
  if (!bookingGroupId) return 0;

  const requestRecord = await tx.transactionDiscounts.findFirst({
    where: {
      BookingGroupID: bookingGroupId,
      DiscountType: "POINT_REQUEST",
    },
    orderBy: { CreatedAt: "desc" },
  });

  return Math.max(0, Number(requestRecord?.ReferenceID || 0));
};

const calculateAppliedPointDiscount = ({
  requestedPoints,
  availablePoints,
  maxDiscountAmount,
}) => {
  if (requestedPoints <= 0 || availablePoints <= 0 || maxDiscountAmount <= 0) {
    return { usedPoints: 0, discountAmount: 0 };
  }

  const maxPointsByAmount = Math.floor(maxDiscountAmount / pointToMoneyRate);
  const usedPoints = Math.max(
    0,
    Math.min(requestedPoints, availablePoints, maxPointsByAmount),
  );

  return {
    usedPoints,
    discountAmount: usedPoints * pointToMoneyRate,
  };
};

const applyRequestedPointsDiscount = async ({
  tx,
  bookingGroupId,
  customerId,
  amountAfterOtherDiscounts,
}) => {
  const requestedPoints = await getRequestedPointsByBooking(tx, bookingGroupId);

  if (requestedPoints <= 0) {
    return { usedPoints: 0, pointDiscountAmount: 0 };
  }

  const loyaltyAccount = await tx.loyaltyAccounts.findFirst({
    where: { CustomerID: customerId },
    select: { CurrentPoints: true },
  });

  const availablePoints = Number(loyaltyAccount?.CurrentPoints || 0);
  const { usedPoints, discountAmount } = calculateAppliedPointDiscount({
    requestedPoints,
    availablePoints,
    maxDiscountAmount: amountAfterOtherDiscounts,
  });

  return {
    usedPoints,
    pointDiscountAmount: discountAmount,
  };
};

const consumeAppliedPointsOnPayment = async (tx, transaction) => {
  const pointDiscount = await tx.transactionDiscounts.findFirst({
    where: {
      BookingGroupID: transaction.BookingGroupID,
      CustomerID: transaction.CustomerID,
      DiscountType: "POINT",
    },
    orderBy: { CreatedAt: "desc" },
  });

  if (!pointDiscount) return;

  const pointsToDeduct = Number(pointDiscount.ReferenceID || 0);
  if (pointsToDeduct <= 0) return;

  const loyaltyAccount = await tx.loyaltyAccounts.findFirst({
    where: { CustomerID: transaction.CustomerID },
    select: { AccountID: true, CurrentPoints: true },
  });

  if (!loyaltyAccount) {
    throw new Error("Khách hàng chưa có tài khoản điểm thưởng.");
  }

  const currentPoints = Number(loyaltyAccount.CurrentPoints || 0);
  if (currentPoints < pointsToDeduct) {
    throw new Error(
      `Điểm hiện tại không đủ để thanh toán. Cần ${pointsToDeduct} điểm, hiện có ${currentPoints} điểm.`,
    );
  }

  await tx.loyaltyAccounts.update({
    where: { AccountID: loyaltyAccount.AccountID },
    data: {
      CurrentPoints: { decrement: pointsToDeduct },
    },
  });

  await tx.pointTransactions.create({
    data: {
      AccountID: loyaltyAccount.AccountID,
      TransactionID: transaction.TransactionID,
      Type: "REDEEM_AT_PAYMENT",
      Points: -pointsToDeduct,
    },
  });
};

const handleLoyaltyAfterPayment = async (tx, transaction) => {
  const finalAmount = parseFloat(transaction.FinalAmount);
  if (finalAmount <= 0) return;

  const loyaltyAccount = await tx.loyaltyAccounts.findFirst({
    where: { CustomerID: transaction.CustomerID },
    include: { tier_configs: true }
  });

  if (!loyaltyAccount) return;

  const pointRate = parseInt(process.env.POINT_CONVERSION_RATE) || 10000;
  const multiplier = loyaltyAccount.tier_configs?.PointMultiplier ? parseFloat(loyaltyAccount.tier_configs.PointMultiplier) : 1;


  const earnedPoints = Math.floor(finalAmount / pointRate) * multiplier;


  const customer = await tx.customers.update({
    where: { CustomerID: transaction.CustomerID },
    data: {
      TotalSpent: { increment: finalAmount },
    }
  });


  let newTierId = loyaltyAccount.TierID;
  const newTotalSpent = parseFloat(customer.TotalSpent);
  const eligibleTiers = await tx.tier_configs.findMany({
    where: { MinSpent: { lte: newTotalSpent } },
    orderBy: { MinSpent: 'desc' }
  });

  if (eligibleTiers.length > 0) {
    newTierId = eligibleTiers[0].TierID;
  }


  await tx.loyaltyAccounts.update({
    where: { AccountID: loyaltyAccount.AccountID },
    data: {
      CurrentPoints: { increment: earnedPoints },
      LifetimePoints: { increment: earnedPoints },
      TierID: newTierId
    }
  });


  if (earnedPoints > 0) {
    await tx.pointTransactions.create({
      data: {
        AccountID: loyaltyAccount.AccountID,
        TransactionID: transaction.TransactionID,
        Type: "EARN",
        Points: earnedPoints,
      }
    });
  }
};

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

  const bookingItems = booking.BookingItems || [];
  const hasCompletedItem = bookingItems.some((item) => item.Status === "Completed");

  if (!hasCompletedItem) {
    throw new Error("Không có xe hoàn thành để lập hóa đơn.");
  }

  const existingTransaction = await prisma.transactions.findFirst({
    where: { BookingGroupID: bookingId },
  });

  if (existingTransaction) {
    if (existingTransaction.Status === "Paid") {
      throw new Error("Giao dịch này đã được thanh toán rồi");
    }
    return existingTransaction;
  }

  let subtotal = 0;
  bookingItems
    .filter((item) => item.Status === "Completed")
    .forEach((item) => {
    item.ServiceLineItems.forEach((lineItem) => {
      subtotal += parseFloat(lineItem.LineTotal || 0);
    });
  });


  const loyaltyAccount = await prisma.loyaltyAccounts.findFirst({
    where: { CustomerID: booking.CustomerID },
    include: { tier_configs: true }
  });

  const tierDiscountPercent = loyaltyAccount?.tier_configs?.DiscountPercent ? parseFloat(loyaltyAccount.tier_configs.DiscountPercent) : 0;
  const tierDiscountAmount = (subtotal * tierDiscountPercent) / 100;

  const transaction = await prisma.$transaction(async (tx) => {
    const amountAfterTier = subtotal - tierDiscountAmount;
    const { usedPoints, pointDiscountAmount } = await applyRequestedPointsDiscount({
      tx,
      bookingGroupId: bookingId,
      customerId: booking.CustomerID,
      amountAfterOtherDiscounts: amountAfterTier,
    });

    const totalDiscount = tierDiscountAmount + pointDiscountAmount;
    const finalAmount = subtotal - totalDiscount;

    const newTx = await tx.transactions.create({
      data: {
        BookingGroupID: bookingId,
        CustomerID: booking.CustomerID,
        Subtotal: subtotal,
        DiscountAmount: totalDiscount,
        FinalAmount: finalAmount,
        Status: "Pending",
      },
    });

    if (tierDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: bookingId,
          CustomerID: booking.CustomerID,
          DiscountType: "TIER",
          DiscountAmount: tierDiscountAmount,
          DiscountName: `Giảm giá hạng ${loyaltyAccount.tier_configs.TierName}`
        }
      });
    }

    if (pointDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: bookingId,
          CustomerID: booking.CustomerID,
          DiscountType: "POINT",
          ReferenceID: usedPoints,
          DiscountAmount: pointDiscountAmount,
          DiscountName: `Quy đổi ${usedPoints} điểm`,
        },
      });
    }

    return newTx;
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

    await consumeAppliedPointsOnPayment(tx, updatedTransaction);

    await handleLoyaltyAfterPayment(tx, updatedTransaction);

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
      const updatedTx = await tx.transactions.update({
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

      await consumeAppliedPointsOnPayment(tx, updatedTx);

      await handleLoyaltyAfterPayment(tx, updatedTx);
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


  if (promotion.BranchID && transaction.BookingGroups?.BranchID !== promotion.BranchID) {
    throw new Error("Mã khuyến mãi không áp dụng cho chi nhánh này");
  }


  let promoDiscount = 0;
  const baseAmount = parseFloat(transaction.Subtotal);

  if (promotion.DiscountType === "PERCENTAGE") {
    promoDiscount = (baseAmount * parseFloat(promotion.DiscountValue)) / 100;
  } else if (promotion.DiscountType === "FIXED_AMOUNT") {
    promoDiscount = parseFloat(promotion.DiscountValue);
  }


  if (promoDiscount > baseAmount) {
    promoDiscount = baseAmount;
  }


  const amountAfterPromo = baseAmount - promoDiscount;

  const loyaltyAccount = await prisma.loyaltyAccounts.findFirst({
    where: { CustomerID: transaction.CustomerID },
    include: { tier_configs: true }
  });

  const tierDiscountPercent = loyaltyAccount?.tier_configs?.DiscountPercent ? parseFloat(loyaltyAccount.tier_configs.DiscountPercent) : 0;
  const tierDiscountAmount = (amountAfterPromo * tierDiscountPercent) / 100;

  const amountAfterPromoAndTier = amountAfterPromo - tierDiscountAmount;
  const { usedPoints, pointDiscountAmount } = await applyRequestedPointsDiscount({
    tx: prisma,
    bookingGroupId: transaction.BookingGroupID,
    customerId: transaction.CustomerID,
    amountAfterOtherDiscounts: amountAfterPromoAndTier,
  });

  const totalDiscount = promoDiscount + tierDiscountAmount + pointDiscountAmount;
  const newFinalAmount = baseAmount - totalDiscount;


  const result = await prisma.$transaction(async (tx) => {

    await tx.transactionDiscounts.deleteMany({
      where: {
        BookingGroupID: transaction.BookingGroupID,
        DiscountType: { in: ['PROMOTION', 'TIER', 'REWARD', 'POINT'] }
      }
    });


    const updatedTx = await tx.transactions.update({
      where: { TransactionID: transactionId },
      data: {
        DiscountAmount: totalDiscount,
        FinalAmount: newFinalAmount
      }
    });


    await tx.transactionDiscounts.create({
      data: {
        BookingGroupID: transaction.BookingGroupID,
        CustomerID: transaction.CustomerID,
        PromotionID: promotionId,
        DiscountType: 'PROMOTION',
        DiscountAmount: promoDiscount,
        DiscountName: promotion.PromotionName
      }
    });


    if (tierDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: transaction.BookingGroupID,
          CustomerID: transaction.CustomerID,
          DiscountType: "TIER",
          DiscountAmount: tierDiscountAmount,
          DiscountName: `Giảm giá hạng ${loyaltyAccount.tier_configs.TierName}`
        }
      });
    }

    if (pointDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: transaction.BookingGroupID,
          CustomerID: transaction.CustomerID,
          DiscountType: "POINT",
          ReferenceID: usedPoints,
          DiscountAmount: pointDiscountAmount,
          DiscountName: `Quy đổi ${usedPoints} điểm`,
        },
      });
    }

    return updatedTx;
  });

  return result;
};

const applyReward = async (transactionId, redemptionId) => {
  const transaction = await prisma.transactions.findUnique({
    where: { TransactionID: transactionId },
    include: { BookingGroups: true }
  });

  if (!transaction) throw new Error("Không tìm thấy hóa đơn");
  if (transaction.Status !== "Pending") {
    throw new Error("Chỉ có thể áp dụng ưu đãi cho hóa đơn chưa thanh toán");
  }

  const redemption = await prisma.rewardRedemptions.findUnique({
    where: { RedemptionID: redemptionId },
    include: { Rewards: true }
  });

  if (!redemption) throw new Error("Mã phần quà không tồn tại");
  if (redemption.CustomerID !== transaction.CustomerID) {
    throw new Error("Phần quà này không thuộc về khách hàng hiện tại");
  }
  if (redemption.Status !== "UNUSED") {
    throw new Error("Phần quà này đã được sử dụng hoặc không hợp lệ");
  }

  let rewardDiscount = parseFloat(redemption.Rewards.DiscountValue || 0);
  const baseAmount = parseFloat(transaction.Subtotal);

  if (rewardDiscount > baseAmount) {
    rewardDiscount = baseAmount;
  }

  const amountAfterReward = baseAmount - rewardDiscount;

  const loyaltyAccount = await prisma.loyaltyAccounts.findFirst({
    where: { CustomerID: transaction.CustomerID },
    include: { tier_configs: true }
  });

  const tierDiscountPercent = loyaltyAccount?.tier_configs?.DiscountPercent ? parseFloat(loyaltyAccount.tier_configs.DiscountPercent) : 0;
  const tierDiscountAmount = (amountAfterReward * tierDiscountPercent) / 100;

  const amountAfterRewardAndTier = amountAfterReward - tierDiscountAmount;
  const { usedPoints, pointDiscountAmount } = await applyRequestedPointsDiscount({
    tx: prisma,
    bookingGroupId: transaction.BookingGroupID,
    customerId: transaction.CustomerID,
    amountAfterOtherDiscounts: amountAfterRewardAndTier,
  });

  const totalDiscount = rewardDiscount + tierDiscountAmount + pointDiscountAmount;
  const newFinalAmount = baseAmount - totalDiscount;

  const result = await prisma.$transaction(async (tx) => {

    await tx.transactionDiscounts.deleteMany({
      where: {
        BookingGroupID: transaction.BookingGroupID,
        DiscountType: { in: ['PROMOTION', 'TIER', 'REWARD', 'POINT'] }
      }
    });

    const updatedTx = await tx.transactions.update({
      where: { TransactionID: transactionId },
      data: {
        DiscountAmount: totalDiscount,
        FinalAmount: newFinalAmount
      }
    });

    await tx.transactionDiscounts.create({
      data: {
        BookingGroupID: transaction.BookingGroupID,
        CustomerID: transaction.CustomerID,
        DiscountType: 'REWARD',
        ReferenceID: redemptionId,
        DiscountAmount: rewardDiscount,
        DiscountName: redemption.Rewards.RewardName
      }
    });

    if (tierDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: transaction.BookingGroupID,
          CustomerID: transaction.CustomerID,
          DiscountType: "TIER",
          DiscountAmount: tierDiscountAmount,
          DiscountName: `Giảm giá hạng ${loyaltyAccount.tier_configs.TierName}`
        }
      });
    }

    if (pointDiscountAmount > 0) {
      await tx.transactionDiscounts.create({
        data: {
          BookingGroupID: transaction.BookingGroupID,
          CustomerID: transaction.CustomerID,
          DiscountType: "POINT",
          ReferenceID: usedPoints,
          DiscountAmount: pointDiscountAmount,
          DiscountName: `Quy đổi ${usedPoints} điểm`,
        },
      });
    }


    await tx.rewardRedemptions.update({
      where: { RedemptionID: redemptionId },
      data: { Status: "USED" }
    });

    return updatedTx;
  });

  return result;
};

export default {
  getAll,
  createFromBooking,
  payManual,
  createVNPayUrl,
  vnpayIPN,
  applyDiscount,
  applyReward,
};
