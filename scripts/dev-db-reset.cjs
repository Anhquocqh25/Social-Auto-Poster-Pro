const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'prisma', 'dev.db');

function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--yes');

  if (!confirmed) {
    console.error(
      [
        'Refusing to reset the development database without explicit confirmation.',
        'This script only targets prisma/dev.db.',
        'Re-run with: node scripts/dev-db-reset.cjs --yes',
      ].join('\n')
    );
    process.exit(1);
  }

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`Deleted development database: ${dbPath}`);
  } else {
    console.log(`Development database did not exist yet: ${dbPath}`);
  }

  const prismaPushCommand =
    process.platform === 'win32'
      ? 'npx prisma db push --skip-generate'
      : 'npx prisma db push --skip-generate';

  execSync(prismaPushCommand, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  console.log('Development database schema recreated successfully.');
}

main();