# Personal Release Notes — Social Auto Poster Pro

## Release Scope
Final committed release track for:

- personal daily use
- safe default operation
- controlled Facebook Page publishing only when explicitly enabled
- truthful local/bulk/story handling
- Linux personal-use packaging

## Current Release Status
**Not yet final PASS**

Current truthful decision:

```text
FAIL — finish remaining blockers inside Phase 25
```

This release checkpoint improves the project materially, but does not close the final release yet.

---

## What Was Completed In This Checkpoint

### 1. Safe baseline re-verified
The project was re-verified with:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Verified:
- TypeScript build chain passes
- production build passes
- snapshot verification passes
- runtime assertions pass
- queue starts
- scheduler starts
- no fake success
- no secret exposure introduced in this checkpoint

### 2. Final baseline blocker fixed
Updated file:
- `src/pages/PostsPage.tsx`

Resolved issue:
- Posts overview runtime assertion blocker

Visible outcome:
- overview search area present
- overview filters visible
- Diagnostics shortcut visible
- probe no longer reports:
  - `posts_filters_missing`
  - `posts_diagnostics_link_missing`

### 3. Historical safety interpretation preserved
Still preserved:
- post `#6` effective `needs_verification`
- post `#26` effective `needs_verification`
- posts `#27` and `#28` blocked-safe history
- `fb_sim_*` never counts as real Facebook success

### 4. Linux packaging artifacts confirmed
Verified output exists:
- `release/linux-unpacked/`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
- `release/Social Auto Poster Pro-0.1.0.AppImage`

Verified sizes:
- AppImage: `113890098` bytes
- snap: `96493568` bytes
- unpacked binary: `177181272` bytes

### 5. Roadmap files corrected
Updated:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`

These files now truthfully state:
- Phase 24 is closed
- Phase 25 is the final committed phase
- Phase 25 is still in progress
- final PASS has not yet been earned

### 6. Personal user guide created
Created:
- `docs/USER_GUIDE_PERSONAL.md`

Primary language:
- Vietnamese

Coverage includes:
- install/run
- accounts/channels
- text/image/video posts
- Story limitation
- statuses / `needs_verification`
- safe mode
- controlled real publish
- restore safe mode
- DB backup
- fresh-PC migration
- troubleshooting

### 7. Phase 25 checkpoint report created
Created:
- `docs/PHASE_25_FINAL_ACCEPTANCE_REPORT.md`

---

## Safety Rules Still In Force

Default state remains:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Still prohibited:
- fake success
- fake Story execution
- remote Facebook edit/delete
- raw token exposure
- tokenized Graph/upload/avatar URLs in normal UI/logs
- native/dedicated Reels API claims
- automatic real-video retry

Canonical scopes remain:
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

---

## Packaging Command
Build command used:

```bash
npm run build
```

Observed result:
- renderer build passed
- electron main build passed
- preload build passed
- electron-builder produced Linux artifacts

---

## Restore Point
Current restore point:

```text
_backups/phase-25-final-acceptance-personal-release-20260621-1740/
```

---

## What Still Blocks Final Personal Release PASS

The following items are still mandatory before the project can be declared complete:

1. full manual UI acceptance across all required screens
2. exactly one controlled real Facebook video publish in Phase 25
3. truthful provider-reach evidence for that publish
4. truthful post/job/attempt evidence for that publish
5. safe external verification of the published/processing result where possible
6. immediate safe-mode restoration after the controlled publish
7. restart proof that blocked-safe behavior is restored
8. final acceptance matrix with full evidence
9. remaining required doc updates:
   - `docs/RUNTIME_TEST_REPORT.md`
   - `docs/RELEASE_READINESS_CHECKLIST.md`
   - `docs/MVP_DEMO_GUIDE.md`
   - `docs/FACEBOOK_OAUTH_TEST_REPORT.md`

---

## Honest Release Summary
This checkpoint makes the release **more ready**, but **not release-complete**.

Truthful current summary:
- baseline is healthy
- packaging artifacts exist
- roadmap state is corrected
- personal guide exists
- final manual acceptance is still incomplete
- new controlled real Facebook video verification is still incomplete

## Current Decision
```text
FAIL — finish remaining blockers inside Phase 25
```
