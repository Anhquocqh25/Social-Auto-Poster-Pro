# Phase 20.1 — Video Metadata Surfacing + Snapshot Enrichment + Controlled Real Text/Image Recheck Report

## Status
Implemented / verified / controlled real text+image recheck completed / safe mode restored

## Goal
Extend the Phase 20 local video foundation into:
- Posts list/detail media-video surfacing
- snapshot enrichment
- Diagnostics aggregate evidence enrichment
- controlled real text/image verification on one Page/account only

Safe default required at rest:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## What Was Implemented

### 1. Posts / Detail media-video surfacing
Updated UI behavior so safe media/video metadata is surfaced more clearly in:
- Posts list
- Post detail
- persisted post review context

Preserved:
- safe external id suffix only
- attempt timeline visibility
- safe Page/account metadata display
- local-only/unsupported messaging for video-related records

### 2. Snapshot enrichment
Extended:
- `scripts/snapshot-posts.mjs`

Result:
- snapshot output now includes richer safe media/video metadata for local QA/reporting
- no token, secret, callback URL, raw OAuth state, or tokenized Graph URL exposure

### 3. Diagnostics aggregate evidence enrichment
Updated:
- `src/pages/DiagnosticsPage.tsx`

Result:
- Diagnostics now surfaces stronger aggregate evidence for media/video-backed records
- output remains secret-safe

### 4. Controlled verification helpers
Added:
- `scripts/phase-20-1-create-test-media.cjs`
- `scripts/phase-20-1-controlled-real-publish-test.cjs`

Created local fixture:
- `.tmp/phase-20-1-media/phase-20-1-test-image.png`

Purpose:
- generate a deterministic local PNG test file
- create exactly two queued controlled posts for one real Page/account only

## Safety Rules Preserved
Preserved:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` default safety boundary
- no OAuth flow changes
- no Facebook Page scope narrowing
- no real Facebook video publish enablement
- no bulk real publish run
- no multi-Page real publish run
- no token exposure
- no secret exposure
- `fb_sim_*` remains non-real evidence only
- old post `#6` remains `needs_verification`

Canonical Facebook Page scopes preserved:
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Canonical source:
- `src/services/facebook/FacebookConfigService.ts`

## Verification

### Baseline
Verified:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `node scripts/snapshot-posts.mjs 14 15 6` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 npm run dev` PASS

Observed:
- app starts
- queue starts
- scheduler starts
- safe blocked-path behavior still works with `FACEBOOK_REAL_PUBLISH_ENABLED=false`

### Controlled real text/image recheck
Temporary controlled setting:
- `FACEBOOK_REAL_PUBLISH_ENABLED=true`

Controlled scope:
- exactly `2` posts
- exactly `1` Page/account
- `1` text-only post
- `1` image post
- `0` video posts
- `0` bulk publish operations

Controlled post creation result:
- post `#21`: text-only
- post `#22`: image post

### Controlled runtime evidence

#### Post `#21`
Observed:
- queue picked the job
- real Facebook text publish path executed
- publish succeeded
- runtime success response contained a real Facebook post id
- no `fb_sim_*` evidence was used

Interpretation:
- controlled real text publish recheck PASS

#### Post `#22`
Observed:
- queue picked the job
- real Facebook image publish path executed
- real Graph `/photos` upload attempt occurred
- Facebook returned:
  - HTTP `500`
  - `OAuthException`
  - safe surfaced message:
    - `An unknown error has occurred.`
- retry scheduling occurred while the flag remained enabled
- after flag restoration, later retry attempts were blocked by readiness gating

Interpretation:
- controlled real image publish recheck was real and reached Facebook
- the attempt did not complete successfully
- failure remained safely surfaced
- no fake success was recorded

### Safe restoration
Restored:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Re-verified:
- `FACEBOOK_UI_ASSERT_ON_START=1 npm run dev`

Observed after restoration:
- app starts
- queue starts
- scheduler starts
- `realPublishingEnabled=false`

Probe results:
- `AccountsPage`
  - `realPublishingEnabled=false`
  - `errors=[]`
- `CreatePostPage`
  - exact blocked message visible
  - no created post delta
  - no job delta
  - `errors=[]`
- `BulkCreatePage`
  - exact blocked message visible
  - modal not opened
  - no created post delta
  - no job delta
  - `errors=[]`
- `PostsPersistedBulkReview`
  - exact blocked message visible
  - modal not opened
  - no created post delta
  - no job delta
  - `errors=[]`

Interpretation:
- safe default restored successfully
- blocked-path behavior remains intact
- no further real publish occurs after restoration

## Files Changed
- `src/pages/PostsPage.tsx`
- `src/pages/DiagnosticsPage.tsx`
- `electron/main.ts`
- `scripts/snapshot-posts.mjs`
- `scripts/phase-20-1-create-test-media.cjs`
- `scripts/phase-20-1-controlled-real-publish-test.cjs`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_VIDEO_PUBLISH_FOUNDATION_REPORT.md`
- `docs/PHASE_20_1_VIDEO_METADATA_SURFACING_SNAPSHOT_REAL_TEST_REPORT.md`

## Known Limitations
- real Facebook video publish remains unsupported
- controlled real image recheck returned a Facebook-side unknown-error response for the minimal PNG fixture
- helper scripts introduced here are operational verification tools, not product UI features
- packaging warnings about missing author/category/icon remain non-blocking metadata warnings

## Recommended Next Task
**Phase 20.2 — Real Image Retry Diagnostics Hardening + Video UX Continuation**

Recommended scope:
- investigate the image unknown-error response only in an explicitly approved controlled test
- continue local-only video UX surfacing
- keep `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- do not enable real Facebook video publish