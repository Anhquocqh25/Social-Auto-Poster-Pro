# Project State - Social Auto Poster Pro

ACTIVE TASK: Persistent per-Windows-user packaged SQLite database

- Windows packaged runtime database bootstrap audit in progress
- development database path remains `<project>/prisma/dev.db`
- packaged production database target is `app.getPath('userData')/social-auto-poster-pro.db`
- startup order must configure `DATABASE_URL` before any Prisma-backed module loads
- existing packaged user databases must be reused and never overwritten
- current build artifacts exist locally but are not committed
- GitHub contains source and documentation only
