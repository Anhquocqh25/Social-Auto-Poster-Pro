import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type prismaClientPackage from '@prisma/client';
import { CURRENT_DATABASE_SCHEMA_VERSION } from './constants';

function getBackupDirectory() {
  return path.join(app.getPath('userData'), 'backups');
}

type PrismaClientLike = Pick<
  InstanceType<typeof prismaClientPackage.PrismaClient>,
  '$executeRawUnsafe'
>;

async function createTimestampedBackup(databasePath: string) {
  const backupDirectory = getBackupDirectory();
  fs.mkdirSync(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    backupDirectory,
    `social-auto-poster-pro-${timestamp}.db`
  );

  fs.copyFileSync(databasePath, backupPath);

  return backupPath;
}

export async function runMigrations(options: {
  databasePath: string;
  currentVersion: number;
  prisma: PrismaClientLike;
}) {
  const { databasePath, currentVersion, prisma } = options;

  if (currentVersion > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than this app supports (${CURRENT_DATABASE_SCHEMA_VERSION}).`
    );
  }

  if (currentVersion === CURRENT_DATABASE_SCHEMA_VERSION) {
    return {
      migrated: false,
      backupPath: null,
      currentVersion,
      targetVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    };
  }

  const backupPath = await createTimestampedBackup(databasePath);

  if (currentVersion === 0) {
    await prisma.$executeRawUnsafe(
      `PRAGMA user_version = ${CURRENT_DATABASE_SCHEMA_VERSION}`
    );

    return {
      migrated: true,
      backupPath,
      currentVersion,
      targetVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    };
  }

  throw new Error(
    `No migration path is defined from schema version ${currentVersion} to ${CURRENT_DATABASE_SCHEMA_VERSION}.`
  );
}