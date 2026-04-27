# 2026-04-26 MyStory Polling Resume Handoff

## Goal / Scope

- Replace Realtime-based completion tracking with 30-second polling for My World picture-book production.
- Make production resilient when the student leaves the creating screen, refreshes, opens another page, or returns through MyPage / direct URL.
- Add a MyPage continue area that routes students to the active production screen, the finished review screen, or the next editable step based on DB state.
- Keep a running implementation log with successes, failures, errors, and improvement notes.

## Source Of Truth Read

- `/Users/user/task/reading_passport/AGENTS.md` - project route map, Stream C My World scope, UI copy constraints, and no-gradient instruction.
- `/Users/user/task/reading_passport/docs/2026-04-26-student-e2e-handoff.md` - current My World E2E context, existing dirty worktree warning, and prior production/image-generation notes.
- `/Users/user/task/reading_passport/src/types/database.ts` - `Story`, `ProductionStatus`, `story_status`, `current_step`, `production_progress`, and image/text fields.
- `/Users/user/task/reading_passport/src/lib/mystory-steps.ts` - My World step-to-route contract.
- `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts` - current synchronous production API and DB progress persistence.
- `/Users/user/task/reading_passport/src/app/api/story/progress/route.ts` - current per-story polling endpoint.
- `/Users/user/task/reading_passport/src/app/book/[id]/mystory/creating/CreatingPageContent.tsx` - current creating screen, 5-second polling, and production-start behavior.
- `/Users/user/task/reading_passport/src/app/book/[id]/mystory/page.tsx` and `MyStoryEntryHub.tsx` - current active draft lookup and continue routing.
- `/Users/user/task/reading_passport/src/app/mypage/page.tsx` - current student MyPage stats and completed story shelf.

## Completed Work

- Created this handoff document before code edits.
- Confirmed existing schema already has production tracking fields, so the first implementation should avoid a new migration unless a hard blocker appears.
- Confirmed current local creating screen polls every 5 seconds and `/api/story/produce` currently waits for image generation before responding.
- Refactored `/api/story/produce` so full production requests set `production_status = processing`, return a `202` start response, and schedule existing image generation with Next `after()`. Single-page regeneration remains synchronous for `/finish`.
- Added `/api/story/active-production` to return the current student's latest draft production job with status, progress, title, and the correct recovery href.
- Added `ActiveGenerationProvider` under `AuthProvider` in `src/app/layout.tsx`; it polls every 30 seconds for student accounts and shows a toast for completed/failed production.
- Changed `/mystory/creating` to 30-second polling and added a separate library button while production continues on the server.
- Updated book-specific MyStory entry routing so completed production drafts go to `/finish`, while processing/failed jobs go to `/creating`.
- Added a MyPage student continue area that routes drafts by DB state and shows production progress when relevant.
- Added a direct failed-state message on `/mystory/creating` so students immediately get retry UI when they revisit a failed production page.
- Added error handling for the DB update that marks a production request as `processing`.
- Added production watchdog support:
  - Migration `/Users/user/task/reading_passport/supabase/migrations/030_story_production_watchdog.sql` adds `production_started_at`, `production_heartbeat_at`, and `production_error_message`.
  - Helper `/Users/user/task/reading_passport/src/lib/story-production-watchdog.ts` marks `processing` jobs as `failed` when the latest heartbeat is older than 10 minutes.
  - `/api/story/produce`, `/api/story/progress`, and `/api/story/active-production` now share the watchdog logic.
  - Production start/progress/completion/failure now updates heartbeat/error fields.
  - Retry and style-regeneration resets clear production timestamps and error messages.

## Validation

- Ran `npm run lint`.
  - First run failed on `ActiveGenerationProvider` because React lint disallowed an immediate effect call that could set state, and `/api/story/active-production` had an unused request parameter.
  - Fixed by removing the unused parameter/import and scheduling the first active-production check with `setTimeout(..., 0)`.
  - Second run passed.
- Ran `npm run build`.
  - Passed successfully with Next.js 16.2.2 / Turbopack.
  - Confirmed `/api/story/active-production`, `/api/story/produce`, MyStory routes, MyPage, and layout compile.
- Ran `npm run lint && npm run build` again after adding the watchdog.
  - Passed successfully.
- Final verification by subagent `019dca2a-cfbc-7c22-b504-4216dc3b54c2` passed.
  - The subagent found no blocking issues.
  - It independently checked there is no Supabase Realtime usage for this implementation.
  - It independently confirmed 30-second polling, background `after()` production start, DB persisted completed/failed states, MyStory/MyPage resume routing, root-mounted toast provider, and `npm run lint` / `npm run build` success.

## Errors And Blockers

- Resolved risk: `/api/story/produce` no longer requires the creating page fetch to stay open for full production.
- Resolved risk: MyStory continue routing no longer sends completed production drafts back to `/creating`.
- Resolved risk: app-wide polling/toast notification now exists.
- Current risk: `after()` is platform-supported on Next/Vercel, but local validation still needs to confirm TypeScript/lint compatibility in this project.
- Resolved risk: a job stuck in `processing` is now detected by watchdog when progress or active-production status is polled.
- Current residual risk: `after()` is still not a durable queue. The watchdog can recover the UI to retry, but it does not resume the killed background worker automatically.
- Current residual risk: production only continues after the initial `/api/story/produce` request reaches the server and marks DB as `processing`.
- Current residual risk: MyPage does not live-refresh its continue card, but the global toast appears and a stale `/creating` link redirects to `/finish` after status fetch.

## Next Work

1. If stronger durability is needed, move production to a real queue/worker outside Vercel `after()`.
2. If browser validation is needed, run a local dev server and inspect `/mypage`, `/book/[id]/mystory`, and `/book/[id]/mystory/creating` with a student account.
3. If desired, add live-refresh for the MyPage continue card after the global toast fires.

## References For Next AI

- `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts` - production endpoint to split start response from background generation.
- `/Users/user/task/reading_passport/src/app/api/story/progress/route.ts` - per-story polling endpoint, likely reusable by creating screen.
- `/Users/user/task/reading_passport/src/app/book/[id]/mystory/creating/CreatingPageContent.tsx` - local production UI and retry logic.
- `/Users/user/task/reading_passport/src/app/book/[id]/mystory/MyStoryEntryHub.tsx` - book-specific continue card.
- `/Users/user/task/reading_passport/src/app/mypage/page.tsx` - global student MyPage where the new continue area belongs.
- `/Users/user/task/reading_passport/src/app/layout.tsx` - root provider mount point for global polling/toast.
- `/Users/user/task/reading_passport/src/types/database.ts` - add TypeScript-only helper types if needed, but avoid schema churn unless required.
- `/Users/user/task/reading_passport/src/components/story/ActiveGenerationProvider.tsx` - root-mounted 30-second polling provider and completion/failure toast.
- `/Users/user/task/reading_passport/src/app/api/story/active-production/route.ts` - student-scoped active production status endpoint used by the global provider.
- `/Users/user/task/reading_passport/src/lib/story-production-watchdog.ts` - 10-minute heartbeat watchdog logic used by status APIs.
- `/Users/user/task/reading_passport/supabase/migrations/030_story_production_watchdog.sql` - DB columns and index required by the watchdog.

## Open Questions

- Whether final production should automatically promote `current_step` from 7 to 8. Current route contract uses `8` for `/complete`, while the editable post-production review screen is `/finish`. This implementation should preserve current app semantics and route completed production drafts to `/finish`.
- Whether the toast should appear for a job that was already completed before the current browser session started. Initial plan: show toast only when a previously observed `processing` job becomes `completed`, while MyPage and entry routes handle already-completed recovery.

## Resume Notes

- Working directory: `/Users/user/task/reading_passport`.
- The repo may already be dirty from prior work. Do not revert unrelated modifications.
- Before resuming a new work segment, read this handoff first and update `Completed Work`, `Validation`, `Errors And Blockers`, and `Next Work`.
- Validation commands passed after the final watchdog code edits: `npm run lint && npm run build`.
- Subagent verification passed and did not edit files.
