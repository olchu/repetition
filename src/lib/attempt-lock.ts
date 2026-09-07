import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Serialize starts, hints, answers and submission across tabs and server instances. */
export function withChildAttemptLock<T>(childId: string, work: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${childId} FOR UPDATE`;
    return work(transaction);
  });
}
