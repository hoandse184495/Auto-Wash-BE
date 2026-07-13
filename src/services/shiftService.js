import prisma from "../config/prisma.js";

const toMinutes = (value) => {
  if (!value) return null;

  const text = value instanceof Date ? value.toISOString().substring(11, 16) : String(value);
  const [hours, minutes] = text.substring(0, 5).split(":").map((item) => parseInt(item, 10));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
};

const formatTimeLabel = (value) => {
  if (!value) return "--:--";

  const text = value instanceof Date ? value.toISOString().substring(11, 16) : String(value);
  return text.substring(0, 5);
};

const validateShiftWithinBranchHours = async (branchId, startTime, endTime) => {
  if (!branchId) {
    throw new Error("Không xác định được chi nhánh của người dùng");
  }

  const branch = await prisma.branches.findUnique({
    where: { BranchID: branchId },
    select: { OpenTime: true, CloseTime: true },
  });

  if (!branch?.OpenTime || !branch?.CloseTime) {
    throw new Error("Chi nhánh chưa thiết lập giờ mở/đóng cửa");
  }

  const openMinutes = toMinutes(branch.OpenTime);
  const closeMinutes = toMinutes(branch.CloseTime);
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    throw new Error("Giờ làm việc không hợp lệ");
  }

  if (startMinutes >= endMinutes) {
    throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
  }

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new Error(
      `Ca làm việc phải nằm trong khung giờ ${formatTimeLabel(branch.OpenTime)} - ${formatTimeLabel(branch.CloseTime)}`
    );
  }
};

const getAll = async (filters) => {
  return await prisma.shifts.findMany({
    where: filters,
    orderBy: {
      StartTime: "asc",
    },
  });
};

const getById = async (id) => {
  return await prisma.shifts.findUnique({
    where: { ShiftID: id },
  });
};

const create = async (data, branchId) => {
  if (!data.StartTime || !data.EndTime) {
    throw new Error("Vui lòng nhập giờ bắt đầu và giờ kết thúc cho ca làm việc");
  }

  await validateShiftWithinBranchHours(branchId, data.StartTime, data.EndTime);

  const existing = await prisma.shifts.findFirst({
    where: { ShiftName: data.ShiftName },
  });
  if (existing) {
    throw new Error("Tên ca làm việc đã tồn tại");
  }

  return await prisma.shifts.create({
    data,
  });
};

const update = async (id, data, branchId) => {
  const existing = await prisma.shifts.findUnique({
    where: { ShiftID: id },
  });

  if (!existing) {
    throw new Error("Không tìm thấy ca làm việc");
  }

  const nextStartTime = data.StartTime || existing.StartTime;
  const nextEndTime = data.EndTime || existing.EndTime;

  if (nextStartTime && nextEndTime) {
    await validateShiftWithinBranchHours(branchId, nextStartTime, nextEndTime);
  }

  return await prisma.shifts.update({
    where: { ShiftID: id },
    data,
  });
};

const deleteSoft = async (id) => {
  return await prisma.shifts.update({
    where: { ShiftID: id },
    data: { Status: "Inactive" },
  });
};

export default {
  getAll,
  getById,
  create,
  update,
  deleteSoft,
};
