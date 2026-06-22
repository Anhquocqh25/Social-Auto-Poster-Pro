# Phase 20.3 — Real Video Upload Design + Media Publish Strategy

## Status
Design completed / no real publish executed / safe mode preserved

## Objective
Define a safe architecture and rollout plan for future **real Facebook video upload** without implementing it yet.

This phase is intentionally **design and architecture only**.

The outcome of this phase is to document:

- how real Facebook video upload should work
- what Graph endpoint strategy is safest
- how queue, retry, progress, and recovery should behave
- how video differs from current text/image flows
- what UI confirmations are required
- what backend guards are required
- what Diagnostics and snapshot must surface
- what must be tested before any explicit future enablement

Safe default remains:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## Hard Boundaries For This Phase
This phase does **not**:

- enable real Facebook video publishing
- run any real video publish
- run any new real image publish
- run any bulk real publish
- change OAuth flow
- narrow Facebook Page scopes
- promise remote edit/delete
- allow multi-Page first-run real video publish
- allow multi-video first-run real video publish
- expose tokens, secrets, callback URLs, raw OAuth state, or tokenized Graph URLs
- fake success
- treat `fb_sim_*` as real success

---

## 1. Current Media Publish Architecture Summary

### 1.1 Current text publish path
Current real Facebook text publish path:

1. UI creates local post metadata
2. immediate real publish uses `status='queued'`
3. queue processes pending publish jobs
4. `QueueService` resolves target account/page context
5. `FacebookPostProvider.publishText()` calls:

```txt
POST /{pageId}/feed
```

6. success requires a real Graph post id
7. result is stored through:
   - `PublishJob`
   - `PublishAttempt`
   - `Post`
   - `PostTarget`

Current evidence:
- text publish already has a controlled real flow
- no direct Graph call is made from the UI

### 1.2 Current image publish path
Current real Facebook image publish path:

1. UI selects a local image file
2. `CreatePostPage` stores local media metadata:
   - `mediaLocalPath`
   - `mediaFileName`
   - `mediaFileSize`
   - `mediaMimeType`
   - `mediaExtension`
3. immediate real publish still routes through queue/job creation
4. `FacebookPostProvider.publishImage()` validates:
   - local file present
   - supported extension/MIME
5. provider uploads local file using multipart form to:

```txt
POST /{pageId}/photos
```

6. success requires a confirmed real Graph id / post id
7. `fb_sim_*` is explicitly rejected as real success

Current evidence:
- local-file image upload exists
- safe provider failure metadata exists
- current image provider failures are safely recorded, not faked

### 1.3 Current bulk publish path
Current controlled bulk publish path is queue-backed and safety-gated.

Observed behavior:
- eligibility review exists
- confirmation modal exists
- batch limit exists
- disabled-flag path is blocked
- video is currently marked unsupported in bulk publish
- no bulk real publish was run in this phase

### 1.4 Current video local-only path
Current app behavior for video is intentionally local-only / metadata-only.

Observed behavior:
- `CreatePostPage` supports:
  - local video picker
  - preview
  - file metadata
  - duration metadata
- video posts can be saved as:
  - draft
  - scheduled
- real “Post Now” for video is explicitly blocked with:

```txt
Real Facebook video publishing is not supported yet. Save as draft or schedule only.
```

Current snapshot behavior:
- video posts are surfaced as `mediaType='video'`
- snapshot marks video as:
  - `isVideo=true`
  - `isUnsupportedForRealPublish=true`
  - `realVideoPublishSupported=false`

### 1.5 Current failure metadata path
Sanitized provider failure metadata is currently stored through:

- `PublishAttempt.responseData`

Not in:
- `PublishJob.responseData` (does not exist)

Current provider metadata structure already includes safe fields such as:
- `provider`
- `endpointCategory`
- `httpStatus`
- `errorType`
- `safeErrorMessage`
- `retryable`
- `timestamp`
- sanitized nested provider response

### 1.6 Current retry classification behavior
Current generic retry logic exists in `PublishJobService.incrementRetry()`:
- exponential backoff
- default `maxRetries=3`

But runtime hardening already treats real Facebook image provider failures more carefully at the queue/diagnostics level.

Important current design truth:
- retry behavior is **not yet specialized per media type**
- future real video upload must **not** inherit generic text/image retry semantics blindly

---

## 2. Current Code Path Findings

### 2.1 `FacebookPostProvider.ts`
Observed:
- `publishText()` uses `/feed`
- `publishImage()` uses multipart local file upload to `/photos`
- `publishVideo()` currently targets `/videos` with `file_url`
- current real video path is not suitable for local-file first-run real publish
- provider error mapping already categorizes:
  - `feed_publish`
  - `photo_upload`
  - `video_publish`

Design implication:
- future real video publish should not rely only on current `file_url` approach
- local-file upload strategy is safer and more aligned with current image UX

### 2.2 `QueueService.ts`
Observed:
- queue is the canonical execution layer
- attempts are always recorded
- `PublishAttempt.responseData` is truncated to safe size
- failed jobs update:
  - job status
  - post target status
  - post status
- queue stats are available
- queue stop/start behavior is observable

Design implication:
- all future real video publish must go through queue
- upload/progress/processing states must integrate with queue lifecycle and restart recovery

### 2.3 `PublishJobService.ts`
Observed:
- pending jobs are selected centrally
- duplicate active jobs are guarded per post/account
- retry scheduling is generic and exponential
- job stats are aggregated by status

Design implication:
- video jobs need either:
  - a specialized media-aware policy layer, or
  - explicit no-auto-retry override before using generic retry increment
- first real video phase should not auto-reschedule failed uploads

### 2.4 `PostService.ts`
Observed:
- post model currently stores media metadata:
  - type
  - local path
  - file name
  - file size
  - MIME
  - extension
  - duration
- post statuses currently include:
  - `draft`
  - `scheduled`
  - `queued`
  - `posting`
  - `published`
  - `partially_failed`
  - `failed`
  - `cancelled`

Design implication:
- current schema is sufficient for local video metadata
- future real video progress states such as `uploading` and `processing` are not yet represented in the persisted model
- these should be introduced in a later implementation phase, not this design phase

### 2.5 `CreatePostPage.tsx`
Observed:
- local image/video pickers already exist
- video metadata is collected
- real publishing availability is checked from connection/config status
- manual real publish is restricted to exactly one Page
- real video publish is explicitly blocked

Design implication:
- future real video UX should extend the existing guarded real-publish pattern
- first real video flow should remain:
  - one Page only
  - one video only
  - explicit confirmation only
  - queue-backed only

### 2.6 `PostsPage.tsx`
Observed:
- media labels already distinguish image vs video
- media file size and duration formatting already exist
- persisted bulk review already treats video as unsupported
- controlled bulk publish safety semantics already exist

Design implication:
- future video status/progress can surface in Posts UI without inventing a brand new UX shell
- but first implementation should not enable bulk video publish

### 2.7 `DiagnosticsPage.tsx`
Observed:
- safe runtime evidence already exists
- diagnostics already surface:
  - `videoPostCount`
  - `unsupportedVideoPostCount`
  - `videoDraftCount`
  - `videoScheduledCount`
  - `videoPublishedCount`
- UI explicitly states real video publish is not supported yet

Design implication:
- Diagnostics already has a safe foundation for video counters
- Phase 20.4+ can extend diagnostics with upload/processing/failure metrics

### 2.8 `scripts/snapshot-posts.mjs`
Observed:
- snapshot is local read-only Prisma inspection
- safe external id suffix is already enforced
- video is explicitly flagged unsupported for real publish
- effective status logic already handles `needs_verification`

Design implication:
- snapshot should be expanded in a future phase to include:
  - upload state
  - processing state
  - safe failure metadata summary
  - stuck upload detection

### 2.9 Prisma schema
Observed current persisted models:
- `Post`
- `PostTarget`
- `PublishJob`
- `PublishAttempt`

Current limitation:
- no explicit persisted fields yet for:
  - upload progress percent
  - upload session state
  - provider processing state
  - provider processing percent
  - video verification state

Design implication:
- first implementation phase will likely require additive schema evolution
- Phase 20.3 remains doc-only and does not introduce migration risk

---

## 3. Real Video Upload Strategy Design

## 3.1 Recommended provider strategy
Recommended first real video strategy:

### Preferred approach
Use a **queue-backed provider upload flow** for a single local video file targeting one Facebook Page only.

Preferred provider category:
- Page video upload
- endpoint category label:
  - `video_upload`

Recommended first implementation target:
- local file upload from the Electron app runtime
- not UI-direct upload
- not remote browser upload
- not bulk upload
- not multi-target upload

### Why not rely on current `file_url` only
Current `publishVideo()` shape uses:
- `file_url`

This is not ideal for the first controlled release because:
- current app video UX is based on local picked files, not hosted public URLs
- remote URLs introduce availability and trust assumptions
- file URL handling may expose additional external dependencies
- resumable progress and restart semantics are harder to reason about if the real upload starts from an external source

Recommended design:
- first real video phase should prefer **local file upload from backend/service layer**
- `file_url` may remain an optional later strategy for advanced cases, not the first controlled rollout

## 3.2 Upload mode options
Future provider layer should support two conceptual modes.

### Mode A — simple upload
Use only for:
- small videos
- first controlled test
- one file
- one Page
- one job

Benefits:
- smallest implementation surface
- easiest observability
- easiest rollback
- easiest evidence capture

Risks:
- may be less resilient for larger files
- may fail more often on unstable networks or timeouts

### Mode B — resumable/chunked upload
Use later for:
- larger videos
- unstable network conditions
- long-running uploads
- richer progress tracking

Benefits:
- better recovery potential
- more accurate progress
- safer for long uploads

Risks:
- more moving parts
- more provider session state
- more restart recovery complexity
- needs stronger sanitization rules

### Recommended rollout
- **Phase 20.4+ first implementation:** simple upload only, tightly controlled
- **Later phase:** resumable/chunked upload after first controlled single-video evidence succeeds

## 3.3 File validation design
Before creating a real video job, backend must validate:

- allowed extension
- allowed MIME
- file exists
- file is readable
- file size > 0
- duration present if available
- duration within acceptable limit
- exactly one local file attached
- media type is exactly `video`
- no mixed media bundle
- not multi-video

Recommended validation categories:

### Extension
Allow only a safe allowlist, for example:
- `.mp4`
- `.mov` only if provider support is confirmed
- optionally `.m4v`

Do not trust extension alone.

### MIME
Allow only a safe allowlist, for example:
- `video/mp4`
- other types only after explicit provider compatibility confirmation

### File size
Validate:
- file exists
- readable local file
- non-zero size
- within configured maximum threshold for first release

Design note:
- first real video phase should use a conservative size limit to reduce timeout risk

### Duration
Validate:
- known duration if available
- non-negative duration
- optional upper bound for first controlled test

Design note:
- duration may come from local metadata and can be missing on some files
- missing duration should not automatically imply success eligibility
- if duration is unavailable, UI should warn and backend should decide based on conservative policy

## 3.4 Expected lifecycle states
Future real video flow needs state separation beyond current text/image semantics.

Recommended conceptual states:

- `draft`
- `queued`
- `uploading`
- `processing`
- `published`
- `failed`
- `cancelled`
- `needs_verification`

Meaning:
- `draft`: local metadata only
- `queued`: accepted for future queue execution
- `uploading`: binary transfer in progress
- `processing`: upload accepted by provider but final publish/processing not yet confirmed
- `published`: provider has confirmed successful publish
- `failed`: known failure with safe metadata
- `cancelled`: local queue-side cancellation before upload starts
- `needs_verification`: uncertain completion or ambiguous provider outcome

### Important distinction
For video, `processing` must be distinct from `published`.

Why:
- provider may accept upload first
- video may still be transcoding / processing
- successful upload acceptance is not always final publish visibility

## 3.5 Progress fields design
Recommended future persisted or derived progress fields:

- `uploadProgressPercent`
- `processingState`
- `processingProgressPercent` if provider-safe and available
- `safeUploadSessionSuffix`
- `safeExternalIdSuffix`
- `providerAcceptedAt`
- `providerLastStatusAt`

Security rule:
- never expose raw upload session token
- never expose tokenized upload URL
- never expose full external provider ids if avoidable
- only safe suffixes may be shown in UI/diagnostics/snapshot

---

## 4. Queue / Retry Design

## 4.1 Queue boundary
Hard requirement:
- no direct Graph call from UI

All future real video publish must flow through:
- UI create/confirm
- local post record
- local publish job creation
- queue execution
- provider call inside service layer

## 4.2 Video jobs must be media-aware
Video jobs must not be treated exactly like text/image jobs.

Required design:
- branch behavior by media type
- use a video-specific execution policy
- record upload/progress transitions distinctly
- avoid generic “posting” semantics for long-running video upload

Recommended internal execution phases:
1. validate media
2. acquire job lock
3. mark `uploading`
4. start provider upload
5. record progress safely
6. if provider returns accepted-but-processing, mark `processing`
7. poll/check safely if needed
8. mark `published` only on confirmed success
9. otherwise mark `failed` or `needs_verification`

## 4.3 No auto retry by default
Required rule for first real video phase:
- **no automatic retry** for real video upload failures

Reason:
- large uploads can be expensive, slow, or ambiguous
- automatic retry may create duplicates or unclear provider state
- timeout or partial acceptance can be misleading

Recommended rule:
- retry must be explicit and manual
- UI should clearly explain why retry is allowed or blocked

## 4.4 Retryable classification design
Retryable classification must be safe and explainable.

Recommended categories:

### Retryable
Potentially retryable only if:
- local file read failed transiently
- upload timed out before provider acceptance was confirmed
- provider returned safe transient status:
  - timeout
  - 429
  - 5xx
- no evidence that provider definitively created the final video post

### Not retryable
Not retryable automatically if:
- unsupported media type
- missing file
- invalid Page readiness
- explicit provider validation rejection
- ambiguous provider acceptance without safe verification resolution

### Needs verification
Use `needs_verification` if:
- provider outcome is ambiguous
- local app cannot confirm published vs failed
- restart occurred after provider acceptance but before safe final confirmation
- upload session state is incomplete and cannot be safely resumed

## 4.5 Restart / recovery behavior
App must survive restart during:
- `queued`
- `uploading`
- `processing`
- `failed`

Recommended recovery behavior:

### Queued
Safe to resume queue pickup normally.

### Uploading
Do not assume upload failed or succeeded.
On restart:
- mark as recovery-required
- inspect persisted session/progress state if resumable upload exists
- if no resumable support yet, mark as `needs_verification` or safe `failed_recoverable`, not success

### Processing
Do not assume final publish success.
On restart:
- re-check safe provider processing state if supported
- if not confirmable, remain `processing` briefly with timeout window or degrade to `needs_verification`

### Failed
Remain failed until explicit retry action.

## 4.6 Stale lock cleanup protections
Current stale lock cleanup must not mark unknown video upload as success.

Required rule:
- stale cleanup may release lock
- stale cleanup may mark job recoverable
- stale cleanup must never infer publish success for video from missing runtime state alone

Recommended safety outcomes after stale cleanup:
- `queued` again only if provider call definitely never started
- `failed` if local failure is certain
- `needs_verification` if provider outcome is uncertain
- never `published` without confirmed provider success evidence

---

## 5. UI Safety Design

## 5.1 Feature gate
Future real video publish UI must remain behind:
- `FACEBOOK_REAL_PUBLISH_ENABLED=true`
- explicit runtime status success
- video-specific enablement rule in later implementation phase

Until explicit implementation phase:
- current UI remains blocked
- current disabled message remains valid

## 5.2 First controlled UX scope
First real video test UX must require:
- exactly one Page
- exactly one video
- no batch
- no bulk
- no multi-Page
- no mixed media set

## 5.3 Confirmation UX
Required confirmation design:

- warning banner that this will publish a real Facebook video
- warning that upload may take time
- warning that provider processing may continue after upload
- warning that local delete does not delete Facebook video
- warning that remote edit/delete is not performed by this app
- confirmation checkbox
- typed confirmation:
  - `PUBLISH VIDEO`
- final confirm button disabled until all conditions pass

Recommended modal summary:
- selected Page
- video file name
- video size
- video duration
- publish mode = controlled real publish
- explicit “one Page / one video only” reminder

## 5.4 Progress UX
Future UI should show at minimum:
- queued
- uploading
- processing
- published
- failed
- cancelled
- needs verification

Recommended progress details:
- upload progress percent
- processing status label
- safe external id suffix
- safe upload session suffix if resumable flow exists
- safe error message
- “View in Posts” navigation

## 5.5 Failure UX
Failure UI must show only safe metadata:
- endpoint category
- HTTP status if available
- provider error type if available
- safe error message
- retryable yes/no
- manual retry allowed/blocked reason

Must not show:
- tokenized upload URL
- raw upload session token
- raw access token
- raw page token
- raw callback/state secrets

---

## 6. Diagnostics / Snapshot Design

## 6.1 Diagnostics counters to add or formalize
Future Diagnostics should include:

- `videoPostCount`
- `videoQueuedCount`
- `videoUploadingCount`
- `videoProcessingCount`
- `videoPublishedCount`
- `videoFailedCount`
- `recentVideoFailureCount`

Current diagnostics already expose some video counters; future implementation should expand them with upload/process breakdown.

## 6.2 Safe failure metadata design
Diagnostics should surface only safe failure metadata, for example:
- `provider`
- `endpointCategory`
- `httpStatus`
- `errorType`
- `safeErrorMessage`
- `retryable`
- `safeExternalIdSuffix`
- `safeUploadSessionSuffix`

Must never expose:
- tokenized upload URL
- upload session token
- raw provider URL with secrets
- raw access token
- raw page token

## 6.3 Snapshot design extensions
Future `snapshot-posts.mjs` evolution should add safe fields for video:

- `mediaType='video'`
- `uploadState`
- `processingState`
- `uploadProgressPercent`
- `safeFailureMeta`
- `effectiveStatus`
- `stuckJobDetection`
- `safeExternalIdSuffix`
- `safeUploadSessionSuffix`

Recommended stuck detection examples:
- `processing` too long without provider update
- `uploading` too long without progress delta
- active lock exists but no recent attempt activity
- pending/processing mismatch after restart

## 6.4 Historical interpretation rules
Historical snapshot interpretation must preserve:
- `fb_sim_*` never counts as real success
- ambiguous provider state may map to `needs_verification`
- `published` requires confirmed real provider evidence

---

## 7. Security Boundaries

Hard boundaries to preserve in future implementation:

- `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- no real video publish until explicit later approval phase
- no bulk video publish in first real video phase
- no multi-video first phase
- no multi-Page first phase
- no background auto publish outside queue control
- no remote edit/delete
- no fake success
- no token exposure
- no tokenized upload URL exposure
- no raw upload session token exposure

Required Page scopes remain unchanged:
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

---

## 8. Image Failure Follow-up Note

Current image failure status to preserve:

- post `#22` image test hit Graph `/photos` and failed with Facebook HTTP `500`
- post `#24` controlled image retry also failed with Facebook HTTP `500`
- both failures were captured safely
- current app behavior is acceptable as long as it:
  - records failure safely
  - does not fake success
  - does not classify `fb_sim_*` as real success

Required follow-up rule:
- do **not** repeatedly retry image publish in this phase

Future image follow-up guidance:
- use a normal user-provided image
- use one clear Page target
- keep safe failure metadata capture
- allow at most one controlled retry
- stop if provider still fails ambiguously

---

## 9. Proposed Implementation Phases

## Phase 20.4 — Controlled Real Video Upload Foundation
Recommended scope:
- no UI-wide enablement
- one Page only
- one video only
- simple upload only
- queue-backed only
- explicit confirmation required
- no auto retry
- safe failure metadata
- safe status persistence

## Phase 20.5 — Video Progress + Diagnostics Surfacing
Recommended scope:
- upload/progress states in UI
- Diagnostics counters for queued/uploading/processing/failed video
- snapshot support for video upload state
- safe stuck-job detection improvements

## Phase 20.6 — Recovery / Resumable Strategy
Recommended scope:
- evaluate resumable upload
- persist safe session markers
- restart-aware recovery
- controlled handling of ambiguous provider outcomes

## Later only
- bulk video publish
- multi-Page video publish
- multi-video support
- remote edit/delete
- background automatic retries

---

## 10. Test Plan Before Any Future Enablement

Before enabling any real video publish in a later phase, require all of the following.

### 10.1 Local validation tests
- valid MP4 accepted
- unsupported extension rejected
- unsupported MIME rejected
- missing file rejected
- unreadable file rejected
- oversized file rejected
- empty file rejected
- ambiguous duration handled safely

### 10.2 Queue behavior tests
- job created only after explicit confirmation
- no direct UI Graph call
- exactly one job created
- restart during queued is safe
- restart during uploading is safe
- restart during processing is safe
- stale lock cleanup never marks success without confirmation

### 10.3 Failure-path tests
- provider 5xx recorded safely
- timeout recorded safely
- retryable classification visible
- no auto retry by default
- explicit retry path only
- `needs_verification` path works for ambiguous outcomes

### 10.4 Success-path tests
- controlled single Page only
- controlled single video only
- published status only after confirmed provider evidence
- safe external id suffix displayed
- attempt timeline captured
- no secret/token exposure

### 10.5 Diagnostics / snapshot tests
- video counters accurate
- upload/processing counters accurate
- safe failure metadata visible
- snapshot output remains local-only and sanitized
- no upload session secret leakage
- no tokenized upload URL leakage

---

## 11. Do-Not-Implement-Yet List

Do not implement yet:
- real video Graph upload
- resumable upload protocol
- provider processing poll loop
- schema migration for upload session persistence
- bulk video real publish
- multi-video queue execution
- multi-Page real video execution
- remote video edit/delete
- automatic retry of real video uploads
- optimistic success for accepted-but-unconfirmed video uploads

---

## 12. Recommended Phase 20.4
Recommended next task:

**Phase 20.4 — Controlled Real Video Upload Foundation (single Page, single video, queue-backed, explicit confirmation, no auto retry)**

Suggested acceptance boundary for Phase 20.4:
- keep `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- implement backend validation and queue-only video job execution path
- add explicit video publish confirmation modal
- support exactly one Page + one video
- no bulk
- no resumable mode yet
- no auto retry
- safe diagnostics and attempt evidence only
- run at most one explicitly authorized controlled real video test

---

## 13. Final Design Summary
The safest path for real Facebook video upload in this app is:

- preserve queue/service-only execution
- start with one local video file, one Page, one job
- prefer a backend local-file upload strategy over current `file_url`-only behavior
- distinguish `uploading` and `processing` from `published`
- require explicit confirmation with `PUBLISH VIDEO`
- disable automatic retries by default
- preserve secret-safe diagnostics and snapshot output
- treat ambiguous provider outcomes as `needs_verification`, never as success
- keep bulk/multi-video/multi-Page out of the first real video phase