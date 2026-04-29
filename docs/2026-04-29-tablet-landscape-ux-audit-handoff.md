# 2026-04-29 Tablet Landscape UX Audit

## Goal / Scope

- Check whether student-facing World Stories flows are usable on older classroom tablets in landscape mode.
- Target viewports: 1024x768, 1024x600, and 960x600 landscape.
- Scope includes student login, map/book selection, language modal, 4-step activity hub, Story Read PDF viewer, Hidden Stories, Questions, My World, Library, and shared navigation.
- Main usability criteria: no horizontal overflow, reliable scrolling at 600px height, touch targets near 44px minimum, visible controls on touch devices, non-hover-dependent workflows, readable Korean copy, and reduced interaction friction on older hardware.

## Source Of Truth Read

- `AGENTS.md` - project route structure, 4-step stamp flow, stream boundaries, student route ownership.
- `Prd.md` - current route contracts, student flow, role/access rules, My World route updates, PDF and Hidden Stories requirements.
- `package.json` - Next.js 16, React 19, Tailwind 4, Framer Motion, scripts for build/lint/dev.
- `src/proxy.ts` - protected route and student-only route guard behavior.
- `src/app/globals.css` - global fonts, body layout, app-level visual utilities.
- `src/app/layout.tsx` - shared layout, `Header`, `MobileNav`, auth/generation providers.

## Completed Work

- Subagent static audit completed:
  - Checked shared navigation, book/activity/read routes, Hidden Stories, Questions, My World creation pages, and Library components.
  - Reported the main tablet risks: PDF controls below the fold, hover-only PDF tap affordances, `lg` right-rail layouts squeezing My World pages at 1024px, Library viewer comments overlaying the book, small header/icon controls, compact Questions inputs, and fixed Hidden Stories overlays.
- Subagent runtime audit completed:
  - Checked `/login`, `/map`, `/book/[id]`, `/activity`, `/read`, `/explore`, `/questions`, `/mystory`, `/library`, and `/passport` at 1024x768, 1024x600, and 960x600.
  - Confirmed the highest-impact runtime issues before fixes: book intro CTA below the 600px fold, Step 4/My World hidden in the activity hub, read controls near/below the fold, and small header/library controls.
- Shared navigation and common controls updated:
  - Header logo/nav/logout hit areas are now at least 44px on tablet.
  - Back buttons, language modal options, continue banner controls, and chat input/send controls were enlarged for touch use.
  - Touch-device page-turn affordances now remain visible through the `coarse-pointer-visible` utility.
- Stream A fixes completed:
  - Book intro now uses a tighter landscape grid so cover, stamps, and primary CTA remain visible at 1024x600 and 960x600.
  - Activity hub now shows all four activity cards in a compact responsive grid; Step 4/My World is visible in old tablet landscape.
  - Activity cards use shorter fixed minimums to reduce vertical pressure.
  - Story Read PDF viewer constrains spread size in short landscape, keeps bottom controls visible, and enlarges arrow/dot navigation controls.
  - Map selected-country panel close control is now a 44px target.
- Stream B fixes completed:
  - Hidden Stories fixed overlays were moved inward and constrained, modal content can scroll, and action/close controls were enlarged.
  - Questions inputs changed to tablet-friendly multi-line fields; remove/add controls are now easier to tap.
- Stream C fixes completed:
  - My World right-rail reservation moved from `lg` to `xl`, so 960-1024px landscape tablets keep the main work area full width.
  - Step sidebar, coach modal controls, draft editor, character form, scene controls, style controls, and finish page navigation were enlarged or made scroll-safe.
- Library fixes completed:
  - Library story viewer comments use a bottom sheet on short landscape tablets instead of covering the book with a side panel.
  - Library card and shelf like buttons are touch-sized.
  - `ShelfBook` was changed from a nested-button structure to a keyboard-accessible `role="button"` wrapper with a separate like button.
  - Sort chips, carousel arrows, hero CTA, book viewer controls, and page dots are touch-sized.

## Validation

- `command -v npx` - passed; Playwright CLI wrapper can be used.
- `npm run lint` - passed with one pre-existing warning in `scripts/_tmp-check.mjs` for unused `readFileSync`.
- `npm run build` - passed.
- Playwright CLI final pass against `http://127.0.0.1:3000`:
  - Viewports: 1024x600, 960x600, 1024x768.
  - Routes: `/map`, `/book/[id]?lang=ko`, `/book/[id]/activity?lang=ko`, `/book/[id]/read?lang=ko`, `/book/[id]/explore?lang=ko`, `/book/[id]/questions?lang=ko`, `/library`.
  - Result: no horizontal overflow detected on tested routes.
  - Result: no visible interactive controls under 40px detected on tested routes.
  - Result: book intro CTA, activity Step 4/My World, Story Read controls, and Library first screen were visually checked in screenshots.
- Screenshot artifacts:
  - `output/playwright/tablet-final-1024x600-*.png`
  - `output/playwright/tablet-final-960x600-*.png`
  - `output/playwright/tablet-final-1024x768-*.png`

## Errors And Blockers

- My World deep route runtime traversal is still gated by activity completion state for the demo student. Those pages were statically patched and covered by build validation, but a full end-to-end My World classroom run should use a seeded student with Step 1-3 completed.
- Questions and map pages naturally exceed 600px height because they contain long forms/lists. This is acceptable as vertical scrolling is available; the audit target was no horizontal overflow and reachable touch controls.
- The existing app already contains gradient CSS in several components. This task did not add new gradients.
- The repository had unrelated dirty files before this audit. Those changes were left intact.

## Next Work

1. Run a seeded My World end-to-end browser pass after preparing a student account with Step 1-3 completed.
2. If classroom devices are slower than expected, add a performance pass for PDF render time and image-heavy Library screens.
3. Keep future student-facing controls at 44px or larger on 960-1024px landscape widths.

## References For Next AI

- `src/components/common/Header.tsx` - desktop/tablet header nav touch target sizes.
- `src/components/common/MobileNav.tsx` - bottom nav only applies below `md`, not tablet landscape.
- `src/components/book/PictureBookViewer.tsx` - Story Read PDF spread, tap zones, page controls.
- `src/components/book/ReadPageClient.tsx` - PDF loading state and read completion phase.
- `src/components/book/ExplorePageClient.tsx` - Hidden Stories cards, dwell progress, challenge modal/buttons.
- `src/components/chat/ContentViewer.tsx` - Hidden Stories modal close/external link controls.
- `src/app/book/[id]/questions/QuestionsPageContent.tsx` - question inputs, add/remove controls, completion CTA.
- `src/components/chat/ChatInput.tsx` - My World chat input/send touch target.
- `src/app/book/[id]/mystory/MyStoryPageContent.tsx` - My World chat/activity phase compact controls.
- `src/components/story/MyStoryStepSidebar.tsx` - floating step control on tablet landscape.

## Open Questions

- Whether classroom tablets are closer to 1024x768 iPad landscape or lower-height Android/Chromebook 1024x600. This audit covers both.
- Whether the intended lesson flow needs teacher-operated projection plus student touch input; if so, buttons need to remain large even on `md`/`lg` widths.

## Resume Notes

- Main implementation files touched for this audit are under `src/components/book`, `src/components/story`, `src/components/common`, `src/components/chat`, and student route components under `src/app/book/[id]`.
- The final Playwright browser session was closed after screenshots were captured.
- Suggested next entry point: seed/advance a student through Step 1-3 and run `/book/[id]/mystory` through `/finish` at 1024x600 and 960x600.
