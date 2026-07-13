import prisma from "../config/prisma.js";

const getDailyCashflow = async (branchId, role, startDate, endDate) => {
  let dateFilter = {};
  if (startDate && endDate) {
    // Parse ngày bắt đầu từ 00:00:00 và ngày kết thúc đến 23:59:59
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    dateFilter = {
      ConfirmedAt: {
        gte: start,
        lte: end,
      },
    };
  } else {
    // Mặc định lấy dữ liệu hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    dateFilter = {
      ConfirmedAt: {
        gte: today,
        lte: endOfToday,
      },
    };
  }

  let branchFilter = {};
  if (role === "Manager" && branchId) {
    branchFilter = {
      Transactions: {
        BookingGroups: {
          BranchID: branchId,
        },
      },
    };
  } else if (role === "Admin" && branchId) { // Admin lọc chi nhánh cụ thể
    branchFilter = {
      Transactions: {
        BookingGroups: {
          BranchID: parseInt(branchId),
        },
      },
    };
  }

  const records = await prisma.paymentRecords.findMany({
    where: {
      Status: "Success",
      ...dateFilter,
      ...branchFilter,
    },
    select: {
      Method: true,
      Amount: true,
      ConfirmedAt: true,
    },
  });

  let totalRevenue = 0;
  const breakdown = {
    CASH: 0,
    BANK_TRANSFER: 0,
    VNPAY: 0,
  };

  const dailyMap = new Map();

  records.forEach((record) => {
    const amount = parseFloat(record.Amount || 0);
    totalRevenue += amount;

    if (breakdown[record.Method] !== undefined) {
      breakdown[record.Method] += amount;
    } else {
      breakdown[record.Method] = amount;
    }

    const confirmedAt = record.ConfirmedAt ? new Date(record.ConfirmedAt) : null;
    const dateKey = confirmedAt ? confirmedAt.toISOString().slice(0, 10) : "unknown";

    const dailyEntry = dailyMap.get(dateKey) || {
      cash: 0,
      transfer: 0,
      other: 0,
      total: 0,
    };

    if (record.Method === "CASH") {
      dailyEntry.cash += amount;
    } else if (record.Method === "BANK_TRANSFER") {
      dailyEntry.transfer += amount;
    } else {
      dailyEntry.other += amount;
    }

    dailyEntry.total += amount;
    dailyMap.set(dateKey, dailyEntry);
  });

  const dailyData = Array.from(dailyMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, values]) => ({
      date,
      cash: values.cash,
      transfer: values.transfer,
      other: values.other,
      total: values.total,
    }));

  const totalOther = Object.entries(breakdown).reduce((sum, [method, value]) => {
    if (method === "CASH" || method === "BANK_TRANSFER") return sum;
    return sum + value;
  }, 0);

  return {
    totalRevenue,
    breakdown,
    dailyData,
    summary: {
      totalCash: breakdown.CASH,
      totalTransfer: breakdown.BANK_TRANSFER,
      totalOther,
      total: totalRevenue,
    },
  };
};

const getBranchPerformance = async (branchId, role) => {
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const branchWhere = {
    Status: { not: "Inactive" },
  };
  if (role === "Manager" && branchId) {
    branchWhere.BranchID = branchId;
  } else if (role === "Admin" && branchId) {
    branchWhere.BranchID = parseInt(branchId);
  }

  const branches = await prisma.branches.findMany({
    where: branchWhere,
    select: { BranchID: true },
  });
  const branchIds = branches.map((branch) => branch.BranchID);

  const activeBookingStatuses = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "InProgress",
    "Completed",
  ];

  const todayCounts = await prisma.bookingGroups.groupBy({
    by: ["BranchID"],
    where: {
      BranchID: { in: branchIds },
      Status: { in: activeBookingStatuses },
      BookingDate: {
        gte: startOfToday,
        lte: endOfToday,
      },
    },
    _count: {
      BookingGroupID: true,
    },
  });

  const monthCounts = await prisma.bookingGroups.groupBy({
    by: ["BranchID"],
    where: {
      BranchID: { in: branchIds },
      Status: { in: activeBookingStatuses },
      BookingDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    _count: {
      BookingGroupID: true,
    },
  });

  const paymentRecords = await prisma.paymentRecords.findMany({
    where: {
      Status: "Success",
      ConfirmedAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      Transactions: {
        BookingGroups: {
          BranchID: { in: branchIds },
        },
      },
    },
    select: {
      Amount: true,
      Transactions: {
        select: {
          BookingGroups: {
            select: {
              BranchID: true,
            },
          },
        },
      },
    },
  });

  const todayMap = new Map();
  todayCounts.forEach((item) => {
    todayMap.set(item.BranchID, item._count.BookingGroupID);
  });

  const monthMap = new Map();
  monthCounts.forEach((item) => {
    monthMap.set(item.BranchID, item._count.BookingGroupID);
  });

  const revenueMap = new Map();
  paymentRecords.forEach((record) => {
    const branchID = record.Transactions?.BookingGroups?.BranchID;
    if (!branchID) return;
    const amount = parseFloat(record.Amount || 0);
    revenueMap.set(branchID, (revenueMap.get(branchID) || 0) + amount);
  });

  return branches.map((branch) => ({
    branchID: branch.BranchID,
    todayBookings: todayMap.get(branch.BranchID) || 0,
    monthBookings: monthMap.get(branch.BranchID) || 0,
    monthlyRevenue: revenueMap.get(branch.BranchID) || 0,
  }));
};

const getManagerOverview = async (branchId, role) => {
  const branchIdNum = branchId ? parseInt(branchId) : null;

  if (role === "Manager" && !branchIdNum) {
    throw new Error("Tài khoản Manager chưa được gán chi nhánh");
  }

  const branchFilter =
    branchIdNum && (role === "Manager" || role === "Admin")
      ? { BookingGroups: { BranchID: branchIdNum } }
      : {};

  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const [totalCompletedBookings, todayBookings, completedToday, pendingBookingsToday] = await Promise.all([
    prisma.bookingItems.count({
      where: {
        Status: "Completed",
        ...branchFilter,
      },
    }),
    prisma.bookingItems.count({
      where: {
        Status: { in: ["Pending", "Confirmed", "CheckedIn", "InProgress", "Completed"] },
        BookingGroups: {
          BookingDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          ...(branchIdNum && (role === "Manager" || role === "Admin")
            ? { BranchID: branchIdNum }
            : {}),
        },
      },
    }),
    prisma.bookingItems.count({
      where: {
        Status: "Completed",
        BookingGroups: {
          BookingDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          ...(branchIdNum && (role === "Manager" || role === "Admin")
            ? { BranchID: branchIdNum }
            : {}),
        },
      },
    }),
    prisma.bookingItems.count({
      where: {
        Status: { in: ["Pending", "Confirmed"] },
        BookingGroups: {
          BookingDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          ...(branchIdNum && (role === "Manager" || role === "Admin")
            ? { BranchID: branchIdNum }
            : {}),
        },
      },
    }),
  ]);

  return {
    totalCompletedBookings,
    todayBookings,
    completedToday,
    pendingBookingsToday,
  };
};

export default {
  getDailyCashflow,
  getBranchPerformance,
  getManagerOverview,
};
