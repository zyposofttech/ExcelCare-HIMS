import { PrismaClient, Prisma } from "./generated/client/index.js";

export const prisma = new PrismaClient();

export { PrismaClient, Prisma };
