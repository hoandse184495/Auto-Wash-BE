import prisma from "../config/prisma.js";

const statusPriority = {
  Pending: 1,
  Confirmed: 2,
  CheckedIn: 3,
  InProgress: 4,
  Completed: 5,
  Cancelled: 0,
};

const normalizeDateKey = (value) => {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
};

const normalizeTimeKey = (value) => {
  const date = new Date(value);
  return date.toISOString().slice(11, 16);
};

const buildDedupKey = (group, item) => {
  const vehicleKey =
    item?.Vehicles?.LicensePlate?.trim().toUpperCase() ||
    `VID-${item.VehicleID || "UNKNOWN"}`;

  return [
    group.BranchID,
    group.CustomerID,
    normalizeDateKey(group.BookingDate),
    normalizeTimeKey(group.StartTime),
    vehicleKey,
  ].join("|");
};

const isBetterItem = (candidate, current) => {
  const candidatePriority = statusPriority[candidate.item.Status] ?? 0;
  const currentPriority = statusPriority[current.item.Status] ?? 0;

  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority;
  }

  const candidateUpdatedAt =
    new Date(candidate.item.UpdatedAt || candidate.group.UpdatedAt || 0).getTime();
  const currentUpdatedAt =
    new Date(current.item.UpdatedAt || current.group.UpdatedAt || 0).getTime();

  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  return candidate.item.BookingItemID > current.item.BookingItemID;
};

const dedupeBookingItemsBySlot = (bookings) => {
  const bestByKey = new Map();

  for (const booking of bookings) {
    const items = booking.BookingItems || [];

    for (const item of items) {
      const key = buildDedupKey(booking, item);
      const current = bestByKey.get(key);
      const candidate = { group: booking, item };

      if (!current || isBetterItem(candidate, current)) {
        bestByKey.set(key, candidate);
      }
    }
  }

  const chosenByGroupId = new Map();

  for (const selected of bestByKey.values()) {
    const groupId = selected.group.BookingGroupID;

    if (!chosenByGroupId.has(groupId)) {
      chosenByGroupId.set(groupId, []);
    }

    chosenByGroupId.get(groupId).push(selected.item);
  }

  return bookings
    .map((booking) => ({
      ...booking,
      BookingItems: chosenByGroupId.get(booking.BookingGroupID) || [],
    }))
    .filter((booking) => booking.BookingItems.length > 0);
};

const toDateOnly = (dateStr) => {
  if (dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
};

const getTodayBookings = async (branchId, customerName, status, bookingDate) => {
  const whereClause = {
    BranchID: branchId,
    BookingDate: toDateOnly(bookingDate),
  };

  if (status) {
    whereClause.Status = status;
  }

  if (customerName) {
    whereClause.Customers = {
      Users: {
        FullName: { contains: customerName },
      },
    };
  }

  const bookings = await prisma.bookingGroups.findMany({
    where: whereClause,
    include: {
      Customers: {
        include: {
          Users: { select: { FullName: true, Phone: true } },
        },
      },
      BookingItems: {
        where: {
          Status: { not: "Cancelled" },
        },
        include: {
          Vehicles: { select: { LicensePlate: true, Brand: true, Model: true } },
          ServiceLineItems: {
            include: { Services: { select: { ServiceName: true } } },
            select: {
              LineTotal: true,
              UnitPrice: true,
              Quantity: true,
            },
          },
        },
      },
      Transactions: {
        select: { Status: true },
      },
    },
    orderBy: { StartTime: "asc" },
  });

  return dedupeBookingItemsBySlot(bookings);
};

const updateBookingItemStatus = async (bookingItemId, status, staffId) => {
  const item = await prisma.bookingItems.findUnique({
    where: { BookingItemID: bookingItemId },
    include: { BookingGroups: true },
  });

  if (!item) throw new Error("Không tìm thấy Booking Item");

  const updateData = { Status: status };

  if (status === "CheckedIn") {
    updateData.CheckInAt = new Date();
  } else if (status === "InProgress") {
    updateData.WashStartAt = new Date();
  } else if (status === "Completed") {
    updateData.CompletedAt = new Date();
  }

  await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.bookingItems.update({
      where: { BookingItemID: bookingItemId },
      data: updateData,
    });

    const allItems = await tx.bookingItems.findMany({
      where: { BookingGroupID: item.BookingGroupID },
    });

    const isAllCompleted = allItems.every((i) => i.Status === "Completed");
    const isAnyInProgress = allItems.some(
      (i) => i.Status === "InProgress" || i.Status === "CheckedIn",
    );

    let groupStatus = item.BookingGroups.Status;

    if (isAllCompleted) {
      groupStatus = "Completed";
    } else if (isAnyInProgress && groupStatus === "Pending") {
      groupStatus = "InProgress";
    }

    if (groupStatus !== item.BookingGroups.Status) {
      await tx.bookingGroups.update({
        where: { BookingGroupID: item.BookingGroupID },
        data: { Status: groupStatus },
      });
    }
  });

  return { message: `Cập nhật trạng thái xe thành ${status} thành công` };
};

const addServicesToItem = async (bookingItemId, branchId, serviceIds) => {
  const item = await prisma.bookingItems.findUnique({
    where: { BookingItemID: bookingItemId },
    include: { BookingGroups: true, ServiceLineItems: true },
  });

  if (!item) throw new Error("Không tìm thấy xe này trong đơn đặt lịch");
  if (item.BookingGroups.BranchID !== branchId)
    throw new Error("Xe này không thuộc chi nhánh của bạn");
  if (item.Status === "Completed")
    throw new Error("Xe đã rửa xong, không thể thêm dịch vụ");

  const branchServices = await prisma.branchServices.findMany({
    where: {
      BranchID: branchId,
      ServiceID: { in: serviceIds },
      Status: "Active",
    },
    include: { Services: true },
  });

  if (branchServices.length !== serviceIds.length) {
    throw new Error(
      "Một số dịch vụ không hợp lệ hoặc không hỗ trợ tại chi nhánh này",
    );
  }

  const existingServiceIds = item.ServiceLineItems.map((s) => s.ServiceID);

  await prisma.$transaction(async (tx) => {
    for (const bs of branchServices) {
      if (existingServiceIds.includes(bs.ServiceID)) continue;

      const price = bs.PriceOverride ?? bs.Services.BasePrice;
      await tx.serviceLineItems.create({
        data: {
          BookingItemID: bookingItemId,
          ServiceID: bs.ServiceID,
          Quantity: 1,
          UnitPrice: price,
          LineTotal: price,
          Note: "Phát sinh tại quán",
        },
      });
    }
  });

  return { message: "Thêm dịch vụ phát sinh thành công" };
};

export default {
  getTodayBookings,
  updateBookingItemStatus,
  addServicesToItem,
};
