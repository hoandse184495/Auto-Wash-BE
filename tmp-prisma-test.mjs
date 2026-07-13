import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const result = await prisma.branches.findMany({ take: 1 });
  console.log(JSON.stringify(result));
} catch (e) {
  console.error('MESSAGE', e.message);
  console.error('STACK', e.stack);
} finally {
  await prisma.$disconnect();
}
