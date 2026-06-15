import { PrismaClient } from "@prisma/client";

// Tạo một instance Prisma Client duy nhất
const prisma = new PrismaClient();

export default prisma;
