# Runtime Test Report

## Scope
Verification for **Phase 25 — Final Acceptance, Real Video Verification & Personal Release** at the current checkpoint after:

- preserving safe default behavior
- fixing the final Posts overview runtime assertion blocker
- re-running baseline TypeScript/build/snapshot/runtime verification
- confirming current Linux packaging artifacts
- capturing current database baseline counts and max IDs
- creating the personal user guide
- updating roadmap/release checkpoint documents truthfully

Safe boundary preserved throughout this checkpoint:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This checkpoint does **not**:
- execute a new controlled real Facebook video publish
- enable real Story publish
- enable real bulk video publish
- change OAuth flow behavior
- narrow Facebook scopes
- expose tokens/secrets/upload URLs
- treat `fb_sim_*` as real Facebook success
- remotely edit/delete Facebook content
- add automatic real-publish retry
- claim native/dedicated Reels API support

## Verification Commands

### Baseline verification
```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 28 27 26 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

### Packaging evidence
```bash
find release -maxdepth 2 \( -type f -o -type d \) | sort
stat -c%s "release/Social Auto Poster Pro-0.1.0.AppImage"
stat -c%s "release/social-auto-poster-pro_0.1.0_amd64.snap"
stat -c%s "release/linux-unpacked/social-auto-poster-pro"
```

### Database baseline evidence
```bash
node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const [postCount, jobCount, attemptCount, maxPost, maxJob, maxAttempt, activeJobs] = await Promise.all([
    prisma.post.count(),
    prisma.publishJob.count(),
    prisma.publishAttempt.count(),
    prisma.post.findFirst({ orderBy: { id: 'desc' }, select: { id: true, status: true, title: true, createdAt: true } }),
    prisma.publishJob.findFirst({ orderBy: { id: 'desc' }, select: { id: true, status: true, postId: true, accountId: true, createdAt: true } }),
    prisma.publishAttempt.findFirst({ orderBy: { id: 'desc' }, select: { id: true, status: true, jobId: true, attemptNumber: true, startedAt: true, finishedAt: true } }),
    prisma.publishJob.findMany({
      where: { status: { in: ['pending', 'processing'] } },
      select: { id: true, postId: true, accountId: true, status: true, retryCount: true, createdAt: true },
      orderBy: { id: 'asc' }
    })
  ]);
  console.log(JSON.stringify({
    counts: { postCount, jobCount, attemptCount },
    maxPost,
    maxJob,
    maxAttempt,
    activeJobs
  }, null, 2));
})().finally(async () => {
  await prisma.$disconnect();
});
NODE
```

## Verified Result

### 1. TypeScript
Result:
- `npx tsc --noEmit`: **PASS**

Confirmed:
- renderer contracts compile
- preload/main IPC compile
- current Posts overview changes compile
- current packaging/build configuration remains valid

### 2. Production build
Result:
- `npm run build`: **PASS**

Observed:
- renderer build passed
- electron main build passed
- preload build passed
- electron-builder packaging completed successfully
- Linux artifacts were produced in `release/`
- only non-blocking chunk-size warnings were emitted

### 3. Snapshot verification
Result:
- `node scripts/snapshot-posts.mjs 28 27 26 25 24 23 22 21 15 14 6`: **PASS**

Observed preserved safety/history:

- post `#28`
  - `status=blocked`
  - `effectiveStatus=blocked`

- post `#27`
  - `status=blocked`
  - `effectiveStatus=blocked`

- post `#26`
  - `status=failed`
  - `effectiveStatus=needs_verification`
  - `needsVerification=true`
  - preserved reason:
    - `Facebook accepted the video upload but final publish confirmation was not returned.`

- post `#25`
  - `status=scheduled`
  - `effectiveStatus=scheduled`

- post `#24`
  - `status=failed`
  - `effectiveStatus=failed`

- post `#23`
  - `status=blocked`
  - `effectiveStatus=blocked`

- post `#21`
  - `status=published`
  - `effectiveStatus=published`

- post `#15`
  - `status=published`
  - `effectiveStatus=published`

- post `#14`
  - `status=published`
  - `effectiveStatus=published`

- post `#6`
  - `status=published`
  - `effectiveStatus=needs_verification`
  - `needsVerification=true`
  - preserved reason:
    - `Local snapshot indicates fb_sim_* evidence on a real Facebook target.`

Also confirmed:
- no duplicate active jobs for the checked posts
- `fb_sim_*` remains non-real evidence only
- safe default remained:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

### 4. Runtime startup / UI assertion verification
Result:
- `FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev`: **PASS**

Observed startup/runtime evidence:
- app started
- queue started
- scheduler started
- runtime source remained `.env.local`
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurred
- no fake success occurred
- no unexpected queued jobs were created by blocked probes

Observed runtime assertion outputs at the current checkpoint:

- `NavigationAndDashboard`
  - blocked-safe probe path remained intact
  - `errors=[]`

- `ConnectedChannelsPage`
  - `realPublishingEnabled=false`
  - exact blocked message visible
  - `errors=[]`

- `PostsPageOverview`
  - current checkpoint now passes
  - visible overview filters present
  - overview Diagnostics shortcut present
  - `errors=[]`

- `DiagnosticsPage`
  - blocked-safe probe output remained compact
  - `errors=[]`

- `SettingsPage`
  - blocked-safe probe output remained compact
  - `errors=[]`

Timeout termination after assertions was expected and acceptable for this verification mode.

## Current Database Baseline Before Any New Controlled Publish
Read-only database baseline captured successfully:

- `postCount=28`
- `jobCount=21`
- `attemptCount=24`

Current maximum IDs:
- max post:
  - `id=28`
  - `status=blocked`
  - `title=Controlled real video upload test — Phase 20.4.1`
  - `createdAt=2026-06-18T22:55:53.951Z`

- max job:
  - `id=21`
  - `status=failed`
  - `postId=28`
  - `accountId=6`
  - `createdAt=2026-06-18T22:55:53.955Z`

- max attempt:
  - `id=24`
  - `status=failed`
  - `jobId=21`
  - `attemptNumber=1`
  - `startedAt=2026-06-18T22:56:36.630Z`
  - `finishedAt=null`

Active jobs:
- `[]`

Interpretation:
- there are currently no `pending` / `processing` duplicate active jobs blocking a future single controlled publish attempt
- the current Phase 25 checkpoint has not yet created a new post/job/attempt beyond the preserved historical baseline

## Packaging Evidence
Verified Linux packaging output exists on disk:

- `release/linux-unpacked/`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
- `release/Social Auto Poster Pro-0.1.0.AppImage`

Verified sizes:
- `release/Social Auto Poster Pro-0.1.0.AppImage`
  - `113890098` bytes
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
  - `96493568` bytes
- `release/linux-unpacked/social-auto-poster-pro`
  - `177181272` bytes

## Interactive/Visible Behavior Verified In This Checkpoint

Observed from assertion-backed runtime evidence and visible corrected UI state:
- Connected Channels route remains reachable
- Create Post stays blocked-safe with real publish disabled
- Bulk Create stays blocked-safe with real publish disabled
- persisted Posts bulk review stays blocked-safe
- Posts overview now shows required filter/diagnostic surfaces for the runtime probe
- channel-oriented wording remains visible
- runtime output remains compact/sanitized
- no tokenized Graph/upload URL exposure appears in runtime logs
- no real publish call is implied by the probe output

## Preserved Historical Baselines

### Phase 20.2.1 image baseline preserved
Canonical evidence still preserved:
- post `#24`
- job `#17`
- attempt `#21`

Preserved interpretation:
- real Facebook image provider path had already been reached previously
- this checkpoint did not fake success
- no new secret/token exposure was introduced

### Video verification baseline preserved
Preserved:
- post `#26` remains effectively `needs_verification`
- posts `#27` and `#28` remain blocked-safe history
- current workspace still does not claim real video publish support/success beyond verified evidence

## Safety/Security Result
Confirmed in this checkpoint:

- no real publish occurred
- no real Story publish occurred
- no real bulk publish occurred
- blocked probe paths did not create posts/jobs unexpectedly
- queue and scheduler still start normally
- startup recovery hardening remains intact
- no token/secret exposure was introduced
- no fake Page avatar/tokenized avatar URL was surfaced in verification output
- no new OAuth scope narrowing was introduced

## Remaining Phase 25 Gaps
This runtime checkpoint does **not** complete the final phase yet.

Still required:
- full manual interactive UI acceptance
- exactly one controlled real Facebook video publish using the normal Create Post Facebook Page flow
- truthful provider-reach evidence
- truthful post/job/attempt evidence
- immediate safe-mode restoration after that controlled publish
- blocked-safe restart proof after restoration
- final acceptance matrix with full evidence
- remaining final doc updates

## Conclusion
Phase 25 baseline runtime verification passed at the current checkpoint with the safe default preserved, the final Posts overview runtime blocker fixed, database baseline captured, and Linux packaging artifacts confirmed. Final project PASS is still blocked by the required controlled real-video publish and full manual UI acceptance.