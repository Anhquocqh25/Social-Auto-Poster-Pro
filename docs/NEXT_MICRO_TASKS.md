# Next Micro Tasks - Phase 5

**Last Updated:** 2026-06-09T17:56:29.000Z  
**Current Phase:** Phase 5 - Facebook Integration & Simulated Mode

## Priority 1: Critical Path (Next 1-2 Days)

### 1. Simulation Facebook Account Creation ⭐ CURRENT TASK
**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** Critical  
**Blocks:** Runtime testing, post lifecycle validation

**Description:**
Implement simulation mode for Facebook account creation to enable safe testing without real OAuth credentials.

**Deliverables:**
- Add `is_simulated` Boolean field to Account model (if not exists)
- Implement `createSimulatedFacebookAccount()` in AccountService
- Add "Simulate Facebook Account" button to AccountsPage
- Display "Simulated" badge on simulated accounts
- Skip real API calls when publishing to simulated accounts
- Add logging for simulated operations

**Success Criteria:**
- Can create simulated accounts from UI
- Simulated accounts work with post creation/publishing
- Clear visual distinction between real and simulated accounts
- No console errors during simulation flow

**Files to Modify:**
- `prisma/schema.prisma` (add field if needed)
- `src/services/AccountService.ts`
- `src/pages/AccountsPage.tsx`
- `src/services/QueueService.ts` or `src/services/PublishJobService.ts`

**Related Docs:**
- See `CURRENT_TASK.md` for detailed specification

---

### 2. Settings Persistence Verification
**Status:** Not Started  
**Effort:** 1-2 hours  
**Priority:** High  
**Depends On:** None

**Description:**
Validate that AppSettingsService correctly persists settings across app restarts in actual Electron runtime.

**Tasks:**
- Create test script to save settings and restart app
- Verify settings load on restart
- Test encryption/decryption roundtrip
- Validate Facebook credentials storage
- Test simulation mode toggle persistence

**Success Criteria:**
- Settings survive app restart
- Encrypted values decrypt correctly
- No data loss or corruption
- Settings UI reflects persisted values

**Files to Verify:**
- `src/services/AppSettingsService.ts`
- `src/pages/SettingsPage.tsx`

---

### 3. Runtime Publishing Test (End-to-End)
**Status:** Not Started  
**Effort:** 1-2 hours  
**Priority:** High  
**Depends On:** Task #1 (Simulation Mode)

**Description:**
Execute complete end-to-end publishing flow with simulated account.

**Test Scenario:**
1. Create simulated Facebook account
2. Create scheduled post
3. Verify scheduler picks up post
4. Verify queue processes job
5. Verify notification is created
6. Verify post status updates to "published"
7. Check console logs for errors

**Success Criteria:**
- Full flow completes without errors
- Post reaches "published" status
- Notification appears in UI
- Database reflects correct state
- Logs show expected progression

---

## Priority 2: Feature Completion (Next Week)

### 4. Notification Drawer UI
**Status:** Not Started  
**Effort:** 4-6 hours  
**Priority:** Medium  
**Depends On:** None

**Description:**
Build full notification drawer/history UI beyond the current topbar panel.

**Tasks:**
- Design notification drawer component
- Implement notification list with pagination
- Add mark-as-read per notification
- Add notification filtering (type, date)
- Add notification details view
- Integrate into Topbar

**Success Criteria:**
- Drawer opens from topbar icon
- Shows all notifications (not just unread)
- Can mark individual notifications as read
- Can filter by type/date
- Smooth UX transitions

**Files to Create/Modify:**
- `src/components/NotificationDrawer.tsx` (new)
- `src/components/layout/Topbar.tsx`
- `src/pages/NotificationsPage.tsx` (optional history page)

---

### 5. Restart Recovery Testing
**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** High  
**Depends On:** Task #3 (Runtime Publishing Test)

**Description:**
Verify app gracefully recovers from crash/restart mid-operation.

**Test Scenarios:**
- Kill app while job is processing
- Restart and verify queue resumes
- Verify stale locks are cleaned
- Verify interrupted posts are marked correctly
- Verify no duplicate job execution

**Tasks:**
- Create restart test script
- Simulate crash during various states
- Validate JobLockService cleanup
- Validate ScheduleService recovery
- Validate QueueService resume

**Success Criteria:**
- No zombie jobs after restart
- Locks properly cleared
- Queue resumes processing
- No duplicate publishes
- Graceful error messages

---

### 6. Post Lifecycle Simulation Enhancement
**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** Medium  
**Depends On:** Task #1 (Simulation Mode)

**Description:**
Enhance simulation mode beyond account creation to simulate various publishing scenarios.

**Features:**
- Simulate API latency (delays)
- Simulate success/failure/partial failure scenarios
- Simulate rate limiting
- Simulate network errors
- Configuration UI for simulation scenarios

**Success Criteria:**
- Can toggle different simulation modes
- Each scenario behaves as expected
- Helps validate error handling
- Useful for development/testing

---

## Priority 3: UX Polish (Next 2 Weeks)

### 7. Facebook Setup UX Improvements
**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** Low  
**Depends On:** None

**Description:**
Improve Facebook OAuth setup experience with better guidance and error messages.

**Tasks:**
- Audit all Facebook-related error messages
- Add inline help text for setup requirements
- Create visual setup guide
- Add troubleshooting tips
- Improve AccountsPage messaging when config missing

**Success Criteria:**
- New users understand setup requirements
- Clear error messages guide to resolution
- Help documentation is accessible
- Reduced confusion during setup

---

### 8. Page Selection in CreatePost
**Status:** Not Started  
**Effort:** 2-3 hours  
**Priority:** Low  
**Depends On:** None

**Description:**
Allow users to select target Facebook page when creating posts.

**Tasks:**
- Fetch pages from account metadata
- Add page selector dropdown in CreatePostPage
- Store selected page with post
- Use correct page access token when publishing
- Handle accounts with no pages

**Success Criteria:**
- Can select target page from dropdown
- Publishes to correct page
- Graceful handling when no pages available

---

## Priority 4: Future Integration (Next Month)

### 9. TikTok Integration
**Status:** Not Started  
**Effort:** 8-12 hours  
**Priority:** Phase 6  
**Depends On:** Phase 5 completion

**Description:**
Implement TikTok OAuth and publishing using similar modular architecture as Facebook.

**Approach:**
- Reuse BaseOAuthProvider pattern
- Create TikTokService with provider modules
- Follow FacebookService architecture
- Add TikTok to AccountsPage
- Support TikTok video requirements

---

### 10. Analytics System
**Status:** Not Started  
**Effort:** 12-16 hours  
**Priority:** Phase 6  
**Depends On:** Phase 5 completion

**Description:**
Track and display post performance metrics.

**Features:**
- Fetch engagement data from platforms
- Store analytics in database
- Dashboard widgets for metrics
- Historical trend charts
- Export analytics reports

---

## Currently Blocked Tasks

None - all priority tasks are unblocked and ready to implement.

---

## Completed Tasks (Archive)

*No completed tasks yet in this tracking document.*

---

## Task Selection Guidelines

### Choose Task #1 (Simulation Mode) if:
- Need to unblock testing
- Want to enable safer development
- Critical path for Phase 5 completion

### Choose Task #2 (Settings Verification) if:
- Concerned about data persistence
- Want to validate core infrastructure
- Can test independently

### Choose Task #4 (Notification UI) if:
- Want user-facing improvements
- Comfortable working on React components
- Backend is already solid

### Avoid Until Prerequisites Met:
- Task #3 requires Task #1 completion
- Task #5 requires Task #3 completion
- Task #6 requires Task #1 completion

---

## Notes

- All tasks assume Windows 11 development environment
- TypeScript compilation and build must pass after each task
- Runtime testing in Electron required for validation
- Follow existing code patterns and architecture
- Maintain type safety (no `any` types)
- Add appropriate logging for debugging
- Update documentation after significant changes