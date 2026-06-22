# Phase 12 Controlled Image Publish Report

## Scope of this pass
This pass fixed two runtime issues discovered during controlled image publish testing:

1. Facebook env/config appeared missing inside the publish worker
2. failed publish attempts could leave the local post stuck in `POSTING`

This pass also retains the earlier immediate queued-job creation fix.

## Backup / Restore Point
Filesystem restore point created at:

- `social-auto-poster-pro/_backups/phase-12-real-image-publish-20260612-1520/`

## Root Cause 1 — Facebook Env Missing In Publish Worker
Observed failure during publish attempt:
- `FACEBOOK_APP_ID is missing`
- `FACEBOOK_APP_SECRET is missing`
- `FACEBOOK_REDIRECT_URI is missing`

Actual root cause:
- `FacebookService` previously relied on env-derived config/config-status state cached during service construction
- publish-time execution could therefore use stale or empty startup config instead of fresh `.env.local` values

This was not an OAuth-flow problem. It was a runtime dependency/config refresh problem.

## Env / Config Load Fix
`src/services/facebook/FacebookService.ts` now:
- rebuilds auth/token/validation dependencies lazily at runtime
- re-reads `loadFacebookEnvConfig()` at use time
- no longer relies on stale cached env-derived config for publish-time validation

Safe logs added:
- `[Env] FACEBOOK_APP_ID present=true/false`
- `[Env] FACEBOOK_APP_SECRET present=true/false`
- `[Env] FACEBOOK_REDIRECT_URI present=true/false`
- `[FacebookConfig] config valid=true/false`

No actual env values are logged.

## Root Cause 2 — POSTING Not Finalized
Observed failure state:
- attempt showed failed
- but post detail still showed `POSTING`

Actual root cause:
- worker moved the post to `posting`
- but config/readiness/media validation failures were not consistently finalized as blocked/failed local post states
- unexpected processing-error paths also did not always force post + target + job finalization strongly enough

## Post Status Finalization Fix
`src/services/QueueService.ts` now:
- marks post as `posting` when worker starts
- classifies non-retryable failures:
  - `FACEBOOK_REAL_PUBLISH_BLOCKED`
  - `FACEBOOK_REAL_PUBLISH_DISABLED`
  - `FACEBOOK_CONFIG_INVALID`
  - `FACEBOOK_VALIDATION_FAILED`
  - `FACEBOOK_PAGE_TOKEN_MISSING`
  - `UNSUPPORTED_MULTIPLE_IMAGES_FOR_REAL_PUBLISH`
  - `UNSUPPORTED_MEDIA_FOR_REAL_PUBLISH`
  - `FACEBOOK_LOCAL_IMAGE_MISSING`
  - `FACEBOOK_UNSUPPORTED_IMAGE_TYPE`
- maps blocked/config/readiness/media validation failures to:
  - local post status `blocked`
- maps runtime/processing failures to:
  - local post status `failed`
- ensures unexpected processing exceptions also finalize:
  - job status `failed`
  - target status `failed`
  - post status `failed`
  - safe local post error message

## Immediate Queue Handoff Fix Retained
Earlier Phase 12 runtime fix remains active:

- `posts:create` now creates publish jobs for immediate queued posts
- queue worker can now pick them
- if no active publish job target can be created:
  - local post is finalized as `failed`
  - safe error is stored

This prevents silent `QUEUED` limbo.

## Safe Diagnostics Added
### Queue logs
- `[PostNow] created postId=... mediaType=... hasMediaLocalPath=true targetPage=...`
- `[Queue] immediate job created jobCount=... postId=...`
- `[Queue] worker picked jobId=... postId=...`
- `[Queue] publish start postId=... platform=facebook mediaType=...`
- `[Queue] publish success postId=...`
- `[Queue] publish failed postId=... safeError=...`

### Facebook publish logs
- `[FacebookService] publishForAccount mediaType=... hasMediaLocalPath=true`
- `[FacebookImagePublish] local file exists=true mime=image/...`
- `[FacebookImagePublish] Graph /photos upload start pageIdMasked=...`
- `[FacebookImagePublish] Graph success idSuffix=...`

Never logged:
- access token
- page token
- app secret
- full page id
- tokenized Graph URL

## Verification Result
Verified in this pass:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` PASS

Observed runtime:
- `.env.local` loaded
- `FACEBOOK_REAL_PUBLISH_ENABLED raw=true`
- Facebook config validation passed
- queue started
- scheduler started

## Controlled Retest Status
Known prior manual runtime result before these fixes:
- one image post was created
- immediate handoff bug first caused silent `QUEUED` limbo
- after that was fixed, worker path ran but failed with missing env/config and left post in `POSTING`

Current code now fixes both of those runtime issues.

Controlled post-fix real image publish retest is still pending manual Electron UI execution.

### Expected post-fix retest behavior
The image post should:
- not remain stuck in `QUEUED`
- not remain stuck in `POSTING`

It should finalize as either:
- `published`
- or `failed` / `blocked`

## Local Status / Attempt Timeline Expectation
After post-fix retest:

### Success
- post status: `published`
- `Published At`: populated
- external id: suffix only
- attempt timeline: success entry
- Facebook visibility: manual confirmation if available

### Failure / Blocked
- post status: `failed` or `blocked`
- local error: safe reason
- attempt timeline: failed entry
- no token/secret exposure

## Flag Status
Observed runtime during current verification:
- `FACEBOOK_REAL_PUBLISH_ENABLED=true`

This report does not claim final restoration yet because the controlled post-fix retest result has not yet been recorded.

## Safety / Security Preserved
Still preserved:
- no OAuth flow changes
- no Page scope changes
- no bulk real publish
- no multi-Page publish
- no automatic publish
- no remote Facebook edit/delete
- no token exposure
- no page-token exposure
- no encrypted-token exposure
- no App Secret exposure
- no raw callback/state exposure
- no tokenized Graph URL exposure
- simulation mode remains intact
- queue remains intact
- scheduler remains intact
- diagnostics remains intact

## Remaining Known Issues
- final controlled real image publish retest result still needs to be recorded
- Graph id suffix is not yet documented after the runtime fix
- final Facebook Page visibility confirmation is not yet documented after the runtime fix
- final restoration to `FACEBOOK_REAL_PUBLISH_ENABLED=false` still needs to be recorded after the retest
- multiple image real publish remains intentionally unsupported
- real video publish remains intentionally unsupported

## Exact Post-Fix Retest Steps
1. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=true`
2. Restart app:
   - `npm run dev`
3. Open **Create Post**
4. Select exactly one real Facebook Page
5. Attach exactly one valid image
6. Enter caption:
   - `Controlled image publish test from Social Auto Poster Pro.`
7. Click `Post Now` once
8. Confirm safe logs show:
   - env/config presence
   - immediate job creation
   - worker pickup
   - publish start
   - local file check
   - `/photos` upload start
   - then success or failure
9. Confirm post no longer remains stuck in:
   - `QUEUED`
   - `POSTING`
10. If success:
   - record Graph id suffix only
   - record local `published` status
   - record attempt timeline success
   - confirm Facebook visibility if possible
11. If failure:
   - record local `failed` / `blocked` status
   - record safe error
   - record attempt timeline failure
12. Restore:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
13. Restart app again