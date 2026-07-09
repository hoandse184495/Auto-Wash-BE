import prisma from "../config/prisma.js";

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
    };
  }

  return customer;
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
  updateProfile,
};
