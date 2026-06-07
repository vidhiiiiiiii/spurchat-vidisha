import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance — Prisma manages its own connection pool,
// creating multiple clients per process leaks connections in dev (tsx watch reloads).
export const prisma = new PrismaClient();
