# Active Task

ACTIVE TASK: Persistent per-Windows-user packaged SQLite database

Current status:
- packaged Windows runtime database bootstrap and persistence verification in progress
- development database remains at `<project>/prisma/dev.db`
- production packaged database must persist per Windows user at `app.getPath('userData')`

Current objective:
- create and verify a persistent SQLite database for each Windows user
- initialize the full schema on first launch
- preserve existing user data across restart, rebuild, update, and reinstall
- prevent any Prisma initialization before packaged `DATABASE_URL` is configured
