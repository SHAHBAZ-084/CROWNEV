import { Prisma, PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

/** Default caps for interactive DB transactions — prevents long-held locks. */
export const DEFAULT_TRANSACTION_OPTIONS: TransactionOptions = {
  maxWait: env.dbTransactionMaxWaitMs,
  timeout: env.dbTransactionTimeoutMs,
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: env.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  });

  const originalTransaction = client.$transaction.bind(client);

  client.$transaction = ((
    arg: Parameters<PrismaClient['$transaction']>[0],
    options?: Parameters<PrismaClient['$transaction']>[1]
  ) => {
    const merged: TransactionOptions = {
      ...DEFAULT_TRANSACTION_OPTIONS,
      ...(options ?? {}),
    };
    return originalTransaction(arg as never, merged as never);
  }) as typeof client.$transaction;

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Run work inside a transaction with default timeout/maxWait applied. */
export function runTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return prisma.$transaction(fn, { ...DEFAULT_TRANSACTION_OPTIONS, ...options });
}
