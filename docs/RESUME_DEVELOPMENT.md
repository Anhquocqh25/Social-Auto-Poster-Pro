# Resume Development

Use this document to resume work on `social-auto-poster-pro` after the paused Phase 25 checkpoint.

## Resume steps

1. Install Git, Node and npm
2. Authenticate to GitHub
3. Clone the private repository
4. Run `npm ci`
5. Run `npx prisma generate`
6. Copy `.env.example` to `.env.local`
7. Enter Facebook credentials locally
8. Keep `FACEBOOK_REAL_PUBLISH_ENABLED=false`
9. Restore the SQLite database separately when needed
10. Run `npx tsc --noEmit`
11. Run `npm run build`
12. Run `npm run dev` or `./run-app.sh`
13. Resume the remaining Phase 25 acceptance checklist

## Items that must be transferred separately

These files must never be stored in GitHub and must be transferred privately if needed:

- `.env.local`
- real SQLite database
- private media
- personal backups

## Resume target

When development resumes, continue from:

**Phase 25 — Final Acceptance, Real Video Verification & Personal Release**

Remaining work includes:

- full manual UI acceptance
- PUBLISH VIDEO modal dry-run evidence
- external Facebook verification for post `#29`
- final packaged-app interactive acceptance
- final Phase 25 PASS decision