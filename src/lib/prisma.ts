import prismaClientPackage from '@prisma/client';

const { PrismaClient } = prismaClientPackage;

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

declare global {
  var prisma: PrismaClientInstance | undefined;
}

function assertDatabaseUrlConfigured() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL must be configured before PrismaClient initialization.'
    );
  }
}

function createPrismaClient() {
  assertDatabaseUrlConfigured();

  return new PrismaClient({
    log: ['error', 'warn'],
  });
}

function getPrismaClient(): PrismaClientInstance {
  if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma ??= createPrismaClient();
    return globalThis.prisma;
  }

  return createPrismaClient();
}

const prisma = new Proxy({} as PrismaClientInstance, {
  get(_target, property, receiver) {
    return Reflect.get(getPrismaClient(), property, receiver);
  },
});

export async function disconnectPrisma() {
  if (globalThis.prisma) {
    await globalThis.prisma.$disconnect();
    globalThis.prisma = undefined;
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    const client = getPrismaClient();
    await client.$disconnect();
  }
}

export default prisma;