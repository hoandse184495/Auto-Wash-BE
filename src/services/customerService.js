import prisma from "../config/prisma.js";

const getEndOfCurrentYear = (date = new Date()) =>
  new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

const applyYearlyPointExpiryForCustomer = async (customerId) => {
  const now = new Date();
  const loyaltyAccounts = await prisma.loyaltyAccounts.findMany({
    where: { CustomerID: customerId },
    select: {
      AccountID: true,
      CurrentPoints: true,
      LastReviewDate: true,
    },
  });

  for (const account of loyaltyAccounts) {
    const currentPoints = Number(account.CurrentPoints || 0);
    const lastReviewDate = account.LastReviewDate;
    const currentYear = now.getFullYear();

    // Legacy fallback: if LastReviewDate is empty, infer by the latest point transaction year.
    if (!lastReviewDate) {
      const latestPointTransaction = await prisma.pointTransactions.findFirst({
        where: { AccountID: account.AccountID },
        orderBy: { CreatedAt: "desc" },
        select: { CreatedAt: true },
      });

      const latestPointYear = latestPointTransaction?.CreatedAt
        ? new Date(latestPointTransaction.CreatedAt).getFullYear()
        : currentYear;

      if (latestPointYear < currentYear && currentPoints > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.loyaltyAccounts.update({
            where: { AccountID: account.AccountID },
            data: {
              CurrentPoints: 0,
              LastReviewDate: now,
            },
          });

          await tx.pointTransactions.create({
            data: {
              AccountID: account.AccountID,
              Type: "EXPIRE_YEAR_END",
              Points: -currentPoints,
              ExpiredAt: getEndOfCurrentYear(new Date(latestPointYear, 11, 31)),
              CreatedAt: now,
            },
          });
        });
        continue;
      }

      // First-time sync: stamp LastReviewDate without expiring points.
      await prisma.loyaltyAccounts.update({
        where: { AccountID: account.AccountID },
        data: { LastReviewDate: now },
      });
      continue;
    }

    const lastReviewYear = new Date(lastReviewDate).getFullYear();

    if (lastReviewYear < currentYear) {
      await prisma.$transaction(async (tx) => {
        await tx.loyaltyAccounts.update({
          where: { AccountID: account.AccountID },
          data: {
            CurrentPoints: 0,
            LastReviewDate: now,
          },
        });

        if (currentPoints > 0) {
          await tx.pointTransactions.create({
            data: {
              AccountID: account.AccountID,
              Type: "EXPIRE_YEAR_END",
              Points: -currentPoints,
              ExpiredAt: getEndOfCurrentYear(new Date(lastReviewYear, 11, 31)),
              CreatedAt: now,
            },
          });
        }
      });
    }
  }
};

const getAllCustomersForAdmin = async () => {
  const customers = await prisma.customers.findMany({
    include: {
      Users: {
        select: {
          UserID: true,
          FullName: true,
          Phone: true,
          Email: true,
          Status: true,
          CreatedAt: true,
        },
      },
      Vehicles: {
        where: { Status: "Active" },
        select: { VehicleID: true },
      },
      LoyaltyAccounts: {
        include: {
          tier_configs: true,
        },
        orderBy: { AccountID: "desc" },
        take: 1,
      },
    },
    orderBy: { CustomerID: "asc" },
  });

  return customers.map((customer) => {
    const loyaltyAccount = customer.LoyaltyAccounts[0] ?? null;
    const tierConfig = loyaltyAccount?.tier_configs ?? null;

    return {
      customerId: customer.CustomerID,
      userId: customer.Users?.UserID ?? customer.UserID ?? null,
      fullName: customer.Users?.FullName ?? "Không rõ",
      email: customer.Users?.Email ?? "",
      phone: customer.Users?.Phone ?? "",
      status: customer.Users?.Status ?? "Unknown",
      createdAt: customer.Users?.CreatedAt ?? customer.CreatedAt ?? null,
      totalVisits: customer.TotalVisits ?? 0,
      totalSpent: Number(customer.TotalSpent ?? 0),
      activeVehicleCount: customer.Vehicles.length,
      loyalty: {
        accountId: loyaltyAccount?.AccountID ?? null,
        currentPoints: loyaltyAccount?.CurrentPoints ?? 0,
        lifetimePoints: loyaltyAccount?.LifetimePoints ?? 0,
        tierId: loyaltyAccount?.TierID ?? null,
        tierName: tierConfig?.TierName ?? "Chưa có hạng",
        tierConfig,
      },
    };
  });
};

const getProfile = async (userId) => {
  const customerByUser = await prisma.customers.findFirst({
    where: { UserID: userId },
    select: { CustomerID: true },
  });

  if (customerByUser?.CustomerID) {
    await applyYearlyPointExpiryForCustomer(customerByUser.CustomerID);
  }

  let customer = await prisma.customers.findFirst({
    where: { UserID: userId },
    include: {
      Users: {
        select: {
          FullName: true,
          Phone: true,
          Email: true,
          CreatedAt: true,
        },
      },
      Vehicles: {
        where: { Status: "Active" },
      },
      LoyaltyAccounts: {
        include: {
          tier_configs: true,
        },
      },
    },
  });

  if (!customer) {
    const user = await prisma.users.findUnique({
      where: { UserID: userId },
      select: {
        FullName: true,
        Phone: true,
        Email: true,
        CreatedAt: true,
      },
    });

    return {
      IsNewCustomer: true,
      Users: user,
      TotalVisits: 0,
      TotalSpent: 0,
      Vehicles: [],
      LoyaltyAccounts: [],
      PointsExpiryDate: getEndOfCurrentYear().toISOString(),
    };
  }

  const pointsExpiryDate = getEndOfCurrentYear().toISOString();

  return {
    ...customer,
    PointsExpiryDate: pointsExpiryDate,
    LoyaltyAccounts: (customer.LoyaltyAccounts || []).map((account) => ({
      ...account,
      PointExpiryDate: pointsExpiryDate,
    })),
  };
};

const getPointsSummary = async (userId) => {
  const customer = await prisma.customers.findFirst({
    where: { UserID: userId },
    select: {
      CustomerID: true,
      TotalSpent: true,
    },
  });

  const pointsExpiryDate = getEndOfCurrentYear().toISOString();

  if (!customer) {
    return {
      currentPoints: 0,
      lifetimePoints: 0,
      totalSpent: 0,
      tierName: "Thành viên",
      pointMultiplier: 1,
      pointsExpiryDate,
      isNewCustomer: true,
    };
  }

  await applyYearlyPointExpiryForCustomer(customer.CustomerID);

  const loyalty = await prisma.loyaltyAccounts.findFirst({
    where: { CustomerID: customer.CustomerID },
    include: { tier_configs: true },
    orderBy: { AccountID: "desc" },
  });

  return {
    currentPoints: Number(loyalty?.CurrentPoints || 0),
    lifetimePoints: Number(loyalty?.LifetimePoints || 0),
    totalSpent: Number(customer.TotalSpent || 0),
    tierName: loyalty?.tier_configs?.TierName || "Thành viên",
    pointMultiplier: Number(loyalty?.tier_configs?.PointMultiplier || 1),
    pointsExpiryDate,
    isNewCustomer: false,
  };
};

const updateProfile = async (userId, data) => {
  const { FullName, Phone } = data;

  const updatedUser = await prisma.users.update({
    where: { UserID: userId },
    data: {
      FullName,
      Phone,
      UpdatedAt: new Date(),
    },
    select: {
      FullName: true,
      Phone: true,
      Email: true,
    },
  });

  return updatedUser;
};

export default {
  getAllCustomersForAdmin,
  getProfile,
  getPointsSummary,
  updateProfile,
};
