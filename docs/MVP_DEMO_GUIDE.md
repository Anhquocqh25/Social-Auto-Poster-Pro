# MVP / Personal Demo Guide

**Phase:** 25 — Final Acceptance, Real Video Verification & Personal Release  
**Mode:** Safe default personal-use checkpoint (`FACEBOOK_REAL_PUBLISH_ENABLED=false`)

## Purpose
Provide a truthful walkthrough for the **current verified build** at the Phase 25 checkpoint.

This guide is suitable for:
- personal local walkthroughs
- showing the current app state without enabling real publish
- verifying blocked-safe behavior
- demonstrating packaging/build readiness
- preparing for the final controlled real-video verification

This guide does **not** claim that Phase 25 is fully complete yet.

Current truthful status:
- baseline/runtime/build/package state is healthy
- personal user guide exists
- Linux artifacts exist
- final manual UI acceptance is still incomplete
- the required new controlled real Facebook video publish is still incomplete

---

## Recommended Demo Start

### 1. Keep safe mode enabled
Default must remain:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Do not enable real publish for the normal walkthrough in this guide.

### 2. Launch the app
```bash
npm run dev
```

### 3. Optional baseline verification
```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 28 27 26 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

---

## Current Verified Demo Scope

At this checkpoint, the app truthfully demonstrates:

1. safe blocked-default Facebook behavior
2. route-level UI availability
3. unified Create Post media flow
4. truthful Story limitation handling
5. truthful Bulk Create local media handling
6. Connected Channels / Page-avatar surfacing
7. Accounts / Diagnostics / Settings routes
8. queue / scheduler startup
9. preserved historical safety classifications
10. Linux packaging output existence

It does **not** yet prove the final Phase 25 closeout requirements by itself.

---

## Route-by-Route Demo Walkthrough

### 1. Dashboard
Go to:
- `/`

Show:
- local summary counts
- navigation into:
  - Create Video
  - Create Image/Text
  - Connected Channels
  - Needs Verification
  - Scheduled

Key message:
- dashboard reflects local runtime-backed state rather than static placeholder text

Truthful limitation:
- final manual acceptance evidence for the complete dashboard checklist is still pending

---

### 2. Connected Channels
Go to:
- `/connected-channels`

Show:
- connected Facebook Page entries
- readiness state
- Page avatar or deterministic fallback
- separation between account identity and Page identity
- operational actions:
  - Add Channel
  - Check Connection
  - Reconnect
  - Remove confirmation

Key message:
- channel selection is Page-oriented and safety-aware
- no fake Group support is claimed

Truthful limitation:
- full manual sign-off for all Connected Channels acceptance items is still pending

---

### 3. Accounts
Go to:
- `/accounts`

Show:
- connected Facebook account identity
- account avatar
- readiness state
- reconnect path
- link back to Connected Channels

Key message:
- account identity is separate from Page publishing targets
- no token viewer is exposed

Truthful limitation:
- full manual sign-off for all Accounts acceptance items is still pending

---

### 4. Create Post
Go to:
- `/create-post`

Show:
- Post / Story selector
- explicit channel selection
- unified Upload Media area
- text entry
- save draft option
- schedule option
- publish-now path staying blocked-safe while real publish is disabled

Demonstrate:
- text-only post setup
- multi-image selection
- exactly one video selection
- image/video mutual exclusion
- Story option showing truthful unsupported/local-only behavior under current safe conditions

Key message:
- the composer is unified and safety-aware
- the app does not silently preselect a default channel
- the app does not fake Story support

Truthful limitation:
- final manual composer acceptance evidence is still pending
- this guide does not count as the required controlled real publish

---

### 5. Posts
Go to:
- `/posts`

Show:
- overview search area
- filter controls
- needs-verification visibility
- Page-oriented context
- media summaries
- distinction between post/story where available
- safe technical wording

Key message:
- Posts overview currently includes the previously missing surfaces needed by the runtime probe
- the current Phase 25 checkpoint fixed the final baseline Posts overview assertion blocker

Truthful limitation:
- full Post Detail manual acceptance is still pending

---

### 6. Bulk Create
Go to:
- `/bulk-create`

Show:
- row-based local creation
- explicit per-row channel selection
- multiple images on a row
- one video on a row
- invalid mixed media rejection
- Story selection remaining truthfully non-real-publish-supported
- review/summary behavior

Key message:
- bulk local workflows remain truthful
- real bulk video publish is still not claimed unless separately verified

Truthful limitation:
- full manual bulk acceptance evidence is still pending

---

### 7. Diagnostics
Go to:
- `/diagnostics`

Show:
- queue state
- scheduler state
- database/runtime summary
- real-publish state
- config source
- safe compact output
- no token exposure

Key message:
- diagnostics expose useful operational state while staying sanitized

Truthful limitation:
- final manual diagnostics sign-off is still pending

---

### 8. Settings
Go to:
- `/settings`

Show:
- language setting
- safe-mode state
- flag source
- application data path guidance
- links to:
  - Connected Channels
  - Accounts
  - Diagnostics

Key message:
- settings remain safety-focused
- no environment editor
- no token viewer

Truthful limitation:
- final manual settings sign-off is still pending

---

## Historical Safety Evidence To Mention

When demonstrating the current build, be explicit that the project still preserves these historical classifications:

- post `#6`
  - effective `needs_verification`
- post `#26`
  - effective `needs_verification`
- posts `#27` and `#28`
  - blocked-safe history
- `fb_sim_*`
  - never counts as real Facebook success

Key message:
- the app prefers truthful uncertainty over fake success

---

## Packaging Demonstration

### Build command
```bash
npm run build
```

### Current verified artifacts
- `release/linux-unpacked/`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
- `release/Social Auto Poster Pro-0.1.0.AppImage`

### Recorded sizes
- AppImage: `113890098` bytes
- snap: `96493568` bytes
- unpacked binary: `177181272` bytes

Key message:
- Linux personal-use packaging is producing real artifacts on disk

Truthful limitation:
- final packaged-app interactive launch evidence is still pending

---

## Optional Database Baseline Walkthrough

Before any future controlled real-video publish, the current baseline can be stated as:

- `postCount=28`
- `jobCount=21`
- `attemptCount=24`
- max post `#28`
- max job `#21`
- max attempt `#24`
- active jobs `[]`

Key message:
- there are currently no active duplicate jobs blocking a future single controlled publish attempt

---

## What This Demo Explicitly Does Not Do

This safe demo does **not**:
- perform a new real Facebook video publish
- claim final Phase 25 PASS
- claim Story real publish support
- claim native/dedicated Reels API support
- claim real bulk video publishing support
- expose tokens or tokenized Graph URLs
- silently enable real publish

---

## Recommended Presenter Notes

Suggested messaging:
- “This build is now in the final Phase 25 release checkpoint.”
- “Safe mode remains the default and blocked-safe behavior is verified.”
- “The Posts overview runtime blocker has been fixed and baseline verification is passing.”
- “Linux packaging artifacts now exist on disk.”
- “We still require one controlled real Facebook video publish and full manual UI acceptance before final PASS.”

---

## Demo Completion Checklist
- [ ] App launched in dev runtime
- [ ] Safe mode confirmed false for real publish enablement
- [ ] Dashboard reviewed
- [ ] Connected Channels reviewed
- [ ] Accounts reviewed
- [ ] Create Post reviewed
- [ ] Posts reviewed
- [ ] Bulk Create reviewed
- [ ] Diagnostics reviewed
- [ ] Settings reviewed
- [ ] Packaging artifacts shown if needed
- [ ] Historical safety classifications explained if needed

---

## Honest Conclusion
The project now has a **truthful final-checkpoint demo flow** for personal use with safe mode preserved by default.

At this checkpoint it is suitable for:
- local walkthroughs
- personal packaging review
- blocked-safe verification
- preparing the final controlled real-video verification

It is **not yet final project PASS**, because the mandatory controlled real Facebook video publish and full manual interactive UI acceptance are still outstanding.