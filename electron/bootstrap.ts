import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  preparePackagedDatabase,
  resolveRuntimeDatabaseContext,
  showDatabaseInitializationError,
} from './database/runtimeDatabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

app.disableHardwareAcceleration();

async function bootstrap() {
  await app.whenReady();

  const runtimeDatabaseContext = resolveRuntimeDatabaseContext(projectRoot);

  fs.mkdirSync(path.dirname(runtimeDatabaseContext.databasePath), {
    recursive: true,
  });

  process.env.DATABASE_URL = runtimeDatabaseContext.databaseUrl;

  if (runtimeDatabaseContext.mode === 'packaged') {
    preparePackagedDatabase(runtimeDatabaseContext);
  }

  console.info(
    '[database] bootstrap context',
    JSON.stringify(
      {
        mode: runtimeDatabaseContext.mode,
        databasePath: runtimeDatabaseContext.databasePath,
        templatePath: runtimeDatabaseContext.templatePath,
      },
      null,
      2
    )
  );

    await import('./main');
}

void bootstrap().catch((error) => {
  const runtimeDatabaseContext = resolveRuntimeDatabaseContext(projectRoot);

  console.error(
    '[database] bootstrap failed',
    error instanceof Error ? error.message : error
  );

  showDatabaseInitializationError(
    error,
    runtimeDatabaseContext.databasePath
  );

  app.exit(1);
});