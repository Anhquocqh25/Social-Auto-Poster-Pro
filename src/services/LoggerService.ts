import prisma from '@/lib/prisma';
import { Log } from '@prisma/client';

type LogLevel = 'info' | 'warning' | 'error';

class LoggerService {
  async log(level: LogLevel, message: string, data?: any): Promise<Log> {
    return prisma.log.create({
      data: {
        level,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });
  }

  async getLogs(level?: LogLevel, page = 1, limit = 50) {
    const where = level ? { level } : {};

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.log.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async clearOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.log.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getRecentErrors(limit = 10): Promise<Log[]> {
    return prisma.log.findMany({
      where: {
        level: 'error',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}

export default new LoggerService();