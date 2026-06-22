# Phase 20 — Video Publish Foundation Report

## Status
Implemented / verified / no real video publish run / superseded by Phase 20.1 follow-up

## Goal
Introduce a safe local-only video foundation without enabling real Facebook video publishing.

Safe default preserved:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## What Was Implemented

### 1. Prisma / Data Model Foundation
Extended `Post` in `prisma/schema.prisma` with safe local media metadata fields:

- `mediaFileName`
- `mediaFileSize`
- `mediaMimeType`
- `mediaExtension`
- `mediaDurationMs`

Applied successfully with:
- `npx prisma generate`
- `npx prisma db push`

### 2. Shared Electron Type / IPC Contract Updates
Updated:
- `src/types/electron.d.ts`
- `src/lib/electronApi.ts`

Added support for:
- richer `PostSnapshot` media metadata
- post create/update payload metadata
- `media.pickVideo()`
- `media.validateVideoPath()`

Safe fallback stubs were also aligned so renderer fallback behavior remains type-safe.

### 3. Main Process Media / Serialization Support
Updated `electron/main.ts` to:
- return media metadata in `serializePost()`
- persist metadata in `posts:create`
- persist metadata in `posts:updateLocal`
- support local video picker:
  - `mp4`
  - `mov`
  - `webm`
  - `mkv`
- support local video path validation

No secrets/tokens/callback values are exposed in these additions.

### 4. Post Service Persistence Support
Updated `src/services/PostService.ts` to:
- accept media metadata in create/update payloads
- preserve metadata when duplicating posts

### 5. Create Post Video Foundation
Updated `src/pages/CreatePostPage.tsx` to:
- allow selecting one local image or one local video
- allow saving video as draft
- allow saving video as scheduled post
- show video-specific local-only warning
- keep Post Now blocked for video with explicit message:

```txt
Real Facebook video publishing is not supported yet. Save as draft or schedule only.
```

## Safety Result

### Preserved
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no OAuth flow change
- no Page scope narrowing
- no real publish expansion
- no bulk real publish expansion
- no auto publish
- no remote edit/delete
- `fb_sim_*` remains non-real evidence only
- old post `#6` remains `needs_verification`

### Explicitly Still Blocked
- real Facebook video publish
- real Facebook video upload path
- any interpretation of video draft/schedule as successful real publish

## Verification

### Commands
- `npx prisma generate` PASS
- `npx prisma db push` PASS
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 npm run dev` PASS

### Runtime Observed
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurs

### Probe Recheck
From runtime probe output:
- `AccountsPage` PASS
- `CreatePostPage` blocked-path PASS
- `BulkCreatePage` flag-false blocked-path PASS
- `PostsPersistedBulkReview` flag-false blocked-path PASS

Interpretation:
- Create Post video foundation did not break existing publish safety gates
- no probe created posts/jobs in blocked paths
- no real publish path was triggered

## Files Changed
- `prisma/schema.prisma`
- `src/types/electron.d.ts`
- `src/lib/electronApi.ts`
- `src/services/PostService.ts`
- `electron/main.ts`
- `src/pages/CreatePostPage.tsx`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_VIDEO_PUBLISH_FOUNDATION_REPORT.md`

## Known Limitations
- local video foundation is currently strongest in Create Post + persistence/IPC layer
- Posts/Bulk/Diagnostics do not yet have full video-focused metadata presentation parity
- video duration metadata may remain null
- no real Facebook video publish path is enabled in this phase

## Follow-up Implemented In Next Pass
Phase 20.1 extended this baseline with:
- Posts list/detail video/media metadata surfacing
- snapshot enrichment
- Diagnostics aggregate evidence enrichment
- controlled real text/image recheck on one Page/account only
- safe restoration back to:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

See:
- `docs/PHASE_20_1_VIDEO_METADATA_SURFACING_SNAPSHOT_REAL_TEST_REPORT.md`

## Recommended Next Task
**Phase 20.2 — Real Image Retry Diagnostics Hardening + Video UX Continuation**

Suggested scope:
- investigate the Facebook unknown-error response seen in the controlled real image recheck only when explicitly approved
- continue local-only video UX surfacing
- keep real Facebook video publish blocked by default