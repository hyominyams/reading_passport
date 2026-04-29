# 2026-04-29 Performance Optimization Handoff

## Goal / Scope

- Inspect the Next.js app for code paths that slow loading or block optimization.
- Fix high-confidence issues while preserving uploaded content assets and the existing product logic.
- Keep user-uploaded/generated content unchanged, especially files under `public/generated-copyright-safe/` and `public/virtual-picture-books/`.

## Source Of Truth Read

- `AGENTS.md` instructions supplied in the task - global UI wording rules, project routes, roles, and four-step activity contract.
- `Prd.md` - current local product contract, route map, stamp rules, language handling, and My World flow.
- `package.json` - Next.js 16.2.2, React 19.2.4, Supabase, Framer Motion, pdfjs dependency, available validation scripts.
- `next.config.ts` - current image domains, dev/tooling options, webpack aliases and watcher settings.
- `src/app/layout.tsx` - global providers, fonts, and always-mounted client providers/navigation.

## Completed Work

- Created this worklog before code edits.
- Confirmed the worktree already contains unrelated modified uploaded/generated content and content generation scripts; those files are out of scope for edits.
- Ran initial optimization scan across `src/app`, `src/components`, and `src/lib`.
- Identified high-confidence optimization targets that do not require changing uploaded content:
  - `src/components/story/ActiveGenerationProvider.tsx` imports Framer Motion globally and polls `/api/story/active-production` on every authenticated student page.
  - `src/components/common/MobileNav.tsx` imports the animated mobile sidebar globally even when the menu is closed.
  - `src/app/admin/page.tsx` and `src/app/teacher/page.tsx` import all dashboard panels up front despite tabbed rendering.
  - `src/components/home/HomeHeroSection.tsx` uses `preload="auto"` for the 12 MB `public/Hero_video.mp4` even though playback waits for user interaction.
  - `src/components/book/PdfCoverThumbnail.tsx` loads PDF.js and renders first-page canvases immediately for every PDF cover instance.
- Split the active-generation toast out of the global provider:
  - Added `src/components/story/ActiveGenerationToast.tsx`.
  - Updated `src/components/story/ActiveGenerationProvider.tsx` to dynamically load the toast only when needed, skip polling while the tab is hidden, and abort slow status fetches after 10 seconds.
- Updated mobile navigation:
  - `src/components/common/MobileNav.tsx` dynamically loads `MobileSidebar` after first menu open, preserving the existing open/close behavior.
- Updated tabbed dashboards:
  - `src/app/admin/page.tsx` dynamically loads admin panels per active tab.
  - `src/app/teacher/page.tsx` dynamically loads non-table dashboard panels and drilldown views.
- Updated home loading behavior:
  - `src/components/home/HomeHeroSection.tsx` now preloads only video metadata for `public/Hero_video.mp4`.
  - Follow-up adjustment: the hero video now starts automatically on page access, with the existing tap/wheel start control kept as fallback if the browser blocks autoplay.
  - `src/components/home/HomeCountryCarousel.tsx` uses `next/image` for carousel images and pauses the auto-rotation timer while the document is hidden.
- Updated PDF rendering:
  - `src/components/book/PdfCoverThumbnail.tsx` waits until a thumbnail is near the viewport before loading PDF.js/rendering, caps DPR at 2, and cancels in-flight render/load work on unmount.
  - `src/components/book/PictureBookViewer.tsx` caps canvas DPR at 2 and cancels in-flight page renders/load tasks during page changes or unmount.
  - `src/lib/pdfjs-loader.ts` type definitions now expose optional `cancel`/`destroy` methods used by the cleanup paths.

## Validation

- `npm run lint` - passed after fixes, with one pre-existing warning:
  - `scripts/_tmp-check.mjs:2` unused `readFileSync`.
- `npx tsc --noEmit` - passed.
- `npm run build` - passed with Next.js 16.2.2 / Turbopack.
- After the hero autoplay follow-up, re-ran:
  - `npm run lint && npx tsc --noEmit` - passed, with the same pre-existing `scripts/_tmp-check.mjs` warning.
  - `npm run build` - passed.

## Errors And Blockers

- Existing dirty worktree had unrelated changes before this task. Current visible unrelated modified files still include:
  - `src/app/api/story/docent-chat/route.ts`
  - `src/app/api/story/docent-recommendations/route.ts`
  - `src/app/api/story/guide-chat/route.ts`
  - `src/app/book/[id]/mystory/MyStoryPageContent.tsx`
- First post-change lint run failed on `PdfCoverThumbnail.tsx` because the fallback path called `setShouldRender` synchronously inside an effect. Fixed by scheduling the fallback state update with a timer.
- First `npx tsc --noEmit` run failed because TypeScript treated `window.setTimeout` in the impossible IntersectionObserver-missing branch as `never`. Fixed by using `typeof IntersectionObserver === 'undefined'`.

## Next Work

1. Run targeted browser checks for `/`, `/map`, `/book/[id]/read`, `/teacher`, and `/admin` with real Supabase credentials/data.
2. Consider server-side pagination or narrower selects for high-volume dashboard queries, especially teacher overview and library/admin lists.
3. Consider a route-level split for `AuthProvider`/authenticated-only UI if public landing performance remains a priority.

## References For Next AI

- `Prd.md` - use sections 4-7 for route and activity behavior before changing screens.
- `next.config.ts` - review image, server package, and dev config before changing build behavior.
- `src/app/layout.tsx` - check global client providers and always-mounted UI before adding any app-wide code.
- `src/components/story/ActiveGenerationProvider.tsx` - global production-status polling and toast behavior.
- `src/components/story/ActiveGenerationToast.tsx` - dynamically loaded completion/failure toast UI.
- `src/components/book/PdfCoverThumbnail.tsx` - first-page PDF thumbnail rendering path used by book covers.
- `src/components/book/PictureBookViewer.tsx` - full PDF reading canvas rendering and cleanup.
- `src/app/admin/page.tsx` and `src/app/teacher/page.tsx` - dashboard tab dynamic loading pattern.

## Open Questions

- Whether dashboard tables need pagination depends on real class/library sizes in production data.
- Whether public landing should avoid global auth boot entirely requires a larger route/layout split.

## Resume Notes

- Current branch/worktree was dirty before this task. Do not revert unrelated existing changes.
- Uploaded/generated content assets were not edited by this pass.
- Suggested next entry point: browser-test the changed routes, then profile dashboard data queries against real production-sized Supabase data.
