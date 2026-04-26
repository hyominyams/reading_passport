# 2026-04-26 Student E2E Handoff

## Goal / Scope

- Verify the currently modified working tree by running a fresh student account through the full World Docent student flow:
  login -> map/book -> Step 1 Story Read -> Step 2 Hidden Stories -> Step 3 questions / World Smart -> Step 4 My World -> library sharing -> reading/comment interaction.
- Record issues, blockers, successful behavior, and exact continuation notes as the work progresses.
- This task started as validation/reporting-focused, then expanded into targeted fixes requested by the user:
  - include student-written `scene_descriptions` in scene image generation;
  - migrate all active image generation from Gemini/Nanobanana-style code paths to OpenAI `gpt-image-2`;
  - preserve generated/uploaded images correctly in library publishing and viewing.

## Source Of Truth Read

- `/Users/user/task/reading_passport/AGENTS.md` - project context, 4-step stamp system, route map, and stream responsibilities.
- `/Users/user/task/reading_passport/Prd.md` - current product flow for login, activity cards, Hidden Stories, questions, My Story, library comments, and role permissions.
- `/Users/user/task/reading_passport/CLAUDE.md` - points to AGENTS.md as the repository instruction source.
- `/Users/user/task/reading_passport/package.json` - Next.js scripts and dependency baseline.
- `/Users/user/task/reading_passport/src/app/login/actions.ts` - student 6-digit-code login behavior.
- `/Users/user/task/reading_passport/src/lib/queries/teacher.ts` - student bulk creation and generated student code behavior.
- `/Users/user/task/reading_passport/src/components/book/ReadPageClient.tsx` - Story Read completion and read stamp submission.
- `/Users/user/task/reading_passport/src/components/book/ExplorePageClient.tsx` - Hidden Stories dwell/challenge requirements and hidden stamp completion.
- `/Users/user/task/reading_passport/src/app/book/[id]/questions/QuestionsPageContent.tsx` - question validation, World Smart sync, and questions stamp completion.
- `/Users/user/task/reading_passport/src/app/book/[id]/mystory/*` - My World entry, draft, scenes, characters, style, creating, finish, and complete flow.
- `/Users/user/task/reading_passport/src/app/api/story/publish/route.ts` - final story publishing to library and mystory stamp update.
- `/Users/user/task/reading_passport/src/app/library/page.tsx` - library listing, likes, read-progress, and comment UI behavior.

## Completed Work

- Created this dated handoff document before executing the E2E flow.
- Confirmed the task will use the current modified working tree, not a clean committed baseline.
- Confirmed `npx` is available for Playwright CLI-based browser verification.
- Observed a dirty worktree with many existing modified/untracked files; those are treated as user/current-work changes and will not be reverted.

## Validation

- Full student E2E was run against the current modified working tree.
- Completed successfully through student login, map/book selection, Step 1, Step 2, Step 3, Step 4 My World, story publishing, library visibility, and cross-student read-progress persistence.
- Cross-student comment submission was attempted but blocked by `story_comments` insert `403`; this is the remaining blocker.

## Progress Log

### 2026-04-26 Initial Setup

- Handoff file path: `/Users/user/task/reading_passport/docs/2026-04-26-student-e2e-handoff.md`.
- Current working directory: `/Users/user/task/reading_passport`.
- Existing repo state includes modified files across admin, teacher, questions, world-smart, My Story, story publishing, API routes, and migrations.
- Important constraint: do not revert existing modified/untracked files. Any new validation data should be isolated to the fresh test student and related generated records.

### 2026-04-26 Environment / DB Check

- Ran `npm run check:db`.
  - Service role counts: `users=3`, `classes=2`, `books=1`, `hidden_content=4`, `activities=1`, `stories=0`.
  - Books by country: `rwanda: 1`.
  - Tanzania-specific check found no Tanzania books.
  - Anonymous RLS check sees 1 approved global book: `[rwanda] Who is a real hero?`.
- Ran `npm run check:books`.
  - Service role and anon key both see one approved book: `[rwanda] Who is a real hero?`.
- Working assumption for E2E: use the current approved `rwanda` book, even though some repository sample assets are named Tanzania.

### 2026-04-26 Test Student Created

- Created a fresh student directly through Supabase service role to avoid changing teacher UI data manually.
- New author student:
  - `id`: `85647100-73dd-4e3f-8cbb-4534fbb77d8c`
  - `nickname`: `E2E학생-988230`
  - `student_code`: `988230`
  - `teacher_id`: `4315d7b7-93c1-49ba-915c-38c4c2801cba`
  - `class`: `3반`
- Existing seeded student reserved for cross-account library comment check:
  - `nickname`: `탐험가토리`
  - `student_code`: `123456`

### 2026-04-26 Student Login / Map

- Started dev server with `npm run dev`.
  - Local URL: `http://localhost:3000`.
  - Server reported ready in Next.js/Turbopack.
- Opened `/login` with Playwright and logged in with fresh student code `988230`.
- Login succeeded and redirected to `/map`.
- Header correctly showed student profile `E2E학생-988230`.
- Map showed one open country: `르완다`, `1권`, `열림`; all other visible countries showed `0권 준비중`.
- Console at this point: 0 errors, 1 warning.

### 2026-04-26 Step 1 Story Read

- Selected `르완다` -> `Who is a real hero?` -> `한국어`.
- Book intro page showed stamp status `0/4` and `탐험 시작하기`.
- Activity page initially showed:
  - Step 1 Story Read available.
  - Step 2 Hidden Stories available.
  - Step 3 질문 만들기 available.
  - World Smart disabled until Step 3.
  - My World locked until Steps 1-3.
- Opened Story Read.
  - PDF viewer loaded with 21 pages.
  - Jumped to the last spread `20-21쪽`; `읽기 완료` button appeared.
  - Clicked `읽기 완료`, selected emotion `용기`, filled one-line impression and read question seed.
  - Saved successfully; app returned to activity page.
- DB verification for new student activity:
  - `activities.id`: `5ce191fd-297c-426a-9c1d-0f8216d6736f`
  - `completed_tabs`: `["read"]`
  - `stamps_earned`: `["read"]`
  - `emotion`: `courage`
  - `one_line`: `주인공이 어려운 상황에서도 용기를 내는 모습이 기억에 남았어요.`
  - `read_question_seed`: `르완다 사람들은 어려움을 함께 이겨낼 때 어떤 도움을 주고받을까요?`
- Activity card showed `WORLD STORY CLEAR` and `Step 1 ✓`.

### 2026-04-26 Step 2 Hidden Stories

- Opened Step 2 Hidden Stories from the activity page.
- Hidden content list contained 4 approved global items:
  1. `르완다 전통 바구니` (`image`) - required 10 seconds.
  2. `르완다 나라 소개 자료` (`pdf`) - required 60 seconds.
  3. `르완다 한눈에 보기` (`link`) - marks read after external tab opens.
  4. `르완다의 자연과 풍경 영상` (`video`) - UI badge says `80%`, but timer requirement completed immediately as `0초` in the overlay.
- Image item:
  - Opened image modal, waited past 10 seconds, closed it.
  - UI changed to `읽음 1/4`; challenge button appeared.
  - Saved summary/curiosity and UI changed to `기록 1/4`.
- PDF item:
  - Opened PDF modal, but iframe displayed `www.unicef.org에서 연결을 거부했습니다`.
  - Console count became 1 error.
  - Despite iframe refusal, timer continued and showed completion after 60 seconds.
  - Saved summary/curiosity and UI changed to `기록 2/4`.
- Link item:
  - Click opened a new browser tab for National Geographic Kids and kept current app tab active.
  - UI immediately counted it as read and showed in-app external link panel.
  - Saved summary/curiosity and UI changed to `기록 3/4`.
- Video item:
  - YouTube iframe loaded.
  - Overlay showed `7초 / 0초` with `완료`; this conflicts with the card badge `80%`.
  - Saved summary/curiosity and UI changed to `읽음 4/4`, `기록 4/4`.
- Clicked `탐험 스탬프 받기`; UI showed `탐험 완료! 스탬프를 획득했어요!`.
- DB verification:
  - `completed_tabs`: `["read", "hidden"]`
  - `stamps_earned`: `["read", "hidden"]`
  - `explore_challenges`: 4 challenge note objects persisted with `summary`, `curiosity`, `content_id`, `content_title`, and `completed_at`.

### 2026-04-26 Step 3 Questions / World Smart

- Continued from `/book/1c1c7a4d-f0ba-4c19-a6a0-81437dec4bc4/questions?lang=ko`.
- The question seed panel correctly carried forward:
  - 1 read question seed from Step 1.
  - 4 Hidden Stories challenge notes from Step 2.
- Filled all required questions:
  - Story/content: 3 questions.
  - Character: 2 questions.
  - World/background: 2 questions.
- The progress indicator changed from `0/7 질문 작성` to `7/7 질문 작성`, and the submit button became enabled.
- Clicked `완료하기`.
  - The page displayed `질문을 검토하고 있어요...`.
  - After validation/sync, it redirected to `/book/1c1c7a4d-f0ba-4c19-a6a0-81437dec4bc4/world-smart?lang=ko&posted=1`.
- World Smart page showed:
  - `질문 14`, `댓글 0`, `채택 대기 14`.
  - The 14 total was expected in this DB because it included 7 new questions from `E2E학생-988230` and 7 existing seeded questions from `탐험가토리`.
  - The success message `질문이 World Smart에 올라왔어요.` appeared.
- DB verification for the new student:
  - `activities.completed_tabs`: `["read", "hidden", "questions"]`
  - `activities.stamps_earned`: `["read", "hidden", "questions"]`
  - `question_posts` created for this student/book: 7 rows.
  - New question distribution: `content=3`, `character=2`, `world=2`.

### 2026-04-26 Step 4 My World Started

- Returned to `/book/1c1c7a4d-f0ba-4c19-a6a0-81437dec4bc4/activity?lang=ko`.
- Activity page showed Step 1, Step 2, and Step 3 as clear, and My World was unlocked.
- Opened My World and clicked `새 이야기 시작하기`.
- New in-progress story was created:
  - `storyId`: `3697f613-b7d7-434c-8a40-a9c2a2defaaa`
  - URL: `/book/1c1c7a4d-f0ba-4c19-a6a0-81437dec4bc4/mystory?storyId=3697f613-b7d7-434c-8a40-a9c2a2defaaa&lang=ko`
- Story type selector rendered with five choices: continue, new protagonist, extra backstory, change ending, and custom.

### 2026-04-26 Step 4 My World Completed / Shared

- Selected story type `이야기 이어쓰기`.
- Chat step:
  - Required student turns: 5.
  - Entered 5 sequential student messages covering character, setting, conflict, action, and ending.
  - The turn counter changed to `5 완료!`.
  - Validation passed with `이야기 재료가 충분해!`.
  - `이야기 만들러 가기` appeared.
  - Dev server logged multiple `OpenAI chat completion returned empty content` warnings for `gpt-5-nano` guide-chat calls with `finishReason: length`; the UI still produced usable fallback/short assistant replies and did not block the student.
- Draft generation:
  - Clicked `이야기 만들러 가기`.
  - Loading state showed `이야기 초안을 만들고 있어요...`.
  - Dev server duration for `/api/story/generate-draft`: `34.2s`.
  - After roughly 40 seconds from click to visible route settle, route moved to `/mystory/draft`.
  - AI draft produced 5 pages with page-level advice.
- Draft rewrite:
  - Filled all 5 `내가 쓰는 이야기` textareas.
  - Progress changed to `5/5 페이지 작성 완료`.
  - Clicked `그림 만들러 가기`.
- Scene step:
  - Route moved to `/mystory/scenes`.
  - Uploaded `/Users/user/task/reading_passport/output/test-cover.png` through the visible file upload UI for all 5 pages.
  - Each page showed an uploaded image preview.
  - This was a test acceleration choice to avoid 5 external image-generation calls while still exercising the upload path.
  - Clicked `주인공 설정하러 가기`.
- Character step:
  - Entered one character:
    - name: `아미나`
    - gender: `여성`
    - appearance: `초록 언덕 마을에 사는 어린이. 밝은 천 옷을 입고 작은 바구니를 들고 다닌다.`
    - personality: `겁이 많지만 도움이 필요한 사람을 보면 그냥 지나치지 못한다.`
  - Did not generate a character sheet image; the UI allowed moving forward after required text fields were valid.
  - Clicked `표지 만들러 가기`.
- Cover step:
  - Title: `함께 돕는 영웅`
  - Author: `E2E학생-988230`
  - Kept cover image mode as `이미지 없이 넘어가기`.
  - Clicked `다음 단계로 이동`.
- Production / finish:
  - Route briefly entered `/mystory/creating`, then moved to `/mystory/finish`.
  - Because all 5 pages had uploaded images, production completed without generating scene images.
  - Finish preview showed `함께 돕는 영웅`, 11 pages total, and a `완성하기로 이동` button.
  - Clicked `완성하기로 이동`.
- Complete / share:
  - Complete page showed Korean original preview and an English translation entry with `5페이지 번역 완료`.
  - Dev server duration for `/api/story/translate`: `6.2s`.
  - Clicked `도서관에 공유하기`, then confirmed `공유하기`.
  - UI showed `도서관 공유가 완료되었어요`.
- DB verification:
  - `stories.id`: `3697f613-b7d7-434c-8a40-a9c2a2defaaa`
  - `stories.story_status`: `completed`
  - `stories.current_step`: `8`
  - `stories.production_status`: `completed`
  - `stories.production_progress`: `100`
  - `stories.cover_design.title`: `함께 돕는 영웅`
  - `stories.final_text`: 5 pages
  - `stories.uploaded_images`: 5 non-empty entries
  - `stories.translated_texts`: includes `en`
  - `library.id`: `9fcf9b83-3110-4857-af5c-c46b2a6055dd`
  - `library.story_title`: `함께 돕는 영웅`
  - `library.author_nickname`: `E2E학생-988230`
  - `activities.completed_tabs`: `["read", "hidden", "questions", "mystory"]`
  - `activities.stamps_earned`: `["read", "hidden", "questions", "mystory"]`
- Console check after sharing: 0 errors, 0 warnings on the current page.

### 2026-04-26 Library / Cross-Student Comment Check

- Opened `/library` as `E2E학생-988230`.
  - The shared story `함께 돕는 영웅` appeared under `르완다`.
  - The featured area also showed the newly shared story preview.
- Logged out and logged in as existing student `탐험가토리` with code `123456`.
- Opened `/library` as `탐험가토리`.
  - The same story `함께 돕는 영웅` was visible.
  - Clicked `읽어보기`.
  - Viewer opened at page `1 / 5`; the library view count changed from `0회` to `1회`.
- Advanced through all pages to page `5 / 5`.
  - DB verification confirmed read completion was saved:
    - `story_read_progress.story_id`: `3697f613-b7d7-434c-8a40-a9c2a2defaaa`
    - `story_read_progress.user_id`: `7a3333f1-8d74-4fc5-8d3c-90f4424c9ba9`
    - `completed`: `true`
    - `last_page`: `5`
    - `total_pages_snapshot`: `5`
- Opened the comments/감상 panel and entered:
  - `용기를 주는 장면이 좋았고 르완다 배경을 더 알고 싶어졌어요.`
- Comment submission did not persist:
  - Browser console showed `403` for `https://ttzstncplgzkbnlhepgh.supabase.co/rest/v1/story_comments`.
  - DB verification showed `story_comments` count for the story remained `0`.
  - The visible story card locally changed the comment count to `1`, but the open panel still showed `감상 (0)` and the empty state.
  - This means the UI currently gives a false success signal when Supabase `.insert()` returns an error object.

## Actual AI API Call Verification

### 2026-04-26 Setup / Scope

- Scope for this pass: keep the current working tree unchanged and verify the real AI API paths that were skipped in the previous E2E.
- Allowed file change: append-only notes in this handoff document.
- Verification target:
  - `/api/story/generate-image` for character sheet generation.
  - `/api/story/generate-image` with `cover_mode: true` for cover image generation.
  - `/api/story/produce` without uploaded drawings, so scene images must be generated by the production path.
  - `/api/story/translate` for English translation.
  - `/api/story/publish` for library sharing.
- Existing student planned for this pass:
  - `student_code`: `988230`
  - reason: this account already has the required Step 1-3 stamps for the Rwanda book, so the test can focus on real AI image/translation/production calls without repeating the non-AI activity flow.
- Initial implementation read:
  - `/api/story/start` archives existing draft stories and inserts a new draft only if the student has `read`, `hidden`, and `questions` stamps.
  - `/api/story/produce` skips only pages with `uploaded_images[i]`; with `uploaded_images` empty/null and non-empty `final_text`, it calls GPT prompt conversion and Gemini image generation for each page.
  - `/api/story/generate-image` requires an authenticated user and stores generated images under `character-images` unless character references are included, in which case it stores under `scene-images`.
  - `/api/story/translate` returns translated pages but does not persist them by itself; the UI normally persists the response afterward.
  - `/api/story/publish` persists story completion, library metadata, and the My World activity stamp.

### 2026-04-26 Preflight

- Port 3000 was already in use by an existing `next-server (v16.2.2)` process (`pid=91689`), so no new dev server was started.
- `http://localhost:3000/login` returned `200 OK`.
- Required environment keys are present in `.env.local`: Supabase URL, anon key, service role key, `OPENAI_API_KEY`, and `GEMINI_API_KEY`.
- `GEMINI_IMAGE_MODEL`: `gemini-3.1-flash-image-preview`.
- DB preflight:
  - Student: `85647100-73dd-4e3f-8cbb-4534fbb77d8c` / `E2E학생-988230` / code `988230`.
  - Book: `1c1c7a4d-f0ba-4c19-a6a0-81437dec4bc4` / `Who is a real hero?` / `rwanda`.
  - Activity: `5ce191fd-297c-426a-9c1d-0f8216d6736f`; stamps already include `read`, `hidden`, `questions`, and `mystory`.
- Browser login with code `988230` succeeded and redirected to `/map`.

### 2026-04-26 New Story Created

- Called `/api/story/start` from the authenticated browser session.
- Response:
  - status: `200`
  - duration: `525ms`
  - `storyId`: `f27e203c-1b02-436b-b5f6-08f6900ec3a4`
  - language: `ko`

### 2026-04-26 Character / Cover Image API Calls

- Called `/api/story/generate-image` for a character sheet.
  - status: `200`
  - duration: `24.261s`
  - model: `gemini-3.1-flash-image-preview`
  - returned URL: `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/character-images/2026-04-26/1cb8c1fe-9187-4faf-b885-006f20632c1c.jpg`
- Called `/api/story/generate-image` again with `cover_mode: true`, `allow_text: true`, `aspect_ratio: 3:4`, and the generated character sheet as a reference image.
  - status: `200`
  - duration: `23.740s`
  - model: `gemini-3.1-flash-image-preview`
  - returned URL: `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/scene-images/2026-04-26/c5e3b267-760a-4c31-b0a8-00cb1fbc7db6.jpg`
  - note: this endpoint stores images under `scene-images` whenever `character_refs` are included, even for `cover_mode`.
- Updated story `f27e203c-1b02-436b-b5f6-08f6900ec3a4` with:
  - `final_text`: 2 Korean pages.
  - `uploaded_images`: `[null, null]`.
  - `scene_images`: `null`.
  - `character_designs[0].imageUrl`: generated character sheet URL above.
  - `cover_image_url`: generated cover URL above.
  - `cover_design.title`: `초록 언덕의 다리`.
  - `production_status`: `pending`.
  - `production_progress`: `0`.

### 2026-04-26 Production API Call

- Called `/api/story/produce` from the authenticated browser session with `storyId=f27e203c-1b02-436b-b5f6-08f6900ec3a4`.
- This story had no uploaded drawings:
  - `uploaded_images`: `[null, null]`
  - `scene_images`: `null` before the call
- Response:
  - status: `200`
  - duration: `55.328s`
  - message: `Production completed`
  - total image tasks: `2`
  - completed image tasks: `2`
  - progress: `100`
  - generated scene URLs:
    1. `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/scene-images/2026-04-26/3b7bfdfe-89f3-420f-aa8f-7f15615048d3.jpg`
    2. `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/scene-images/2026-04-26/55af9500-8fda-495d-8812-4e0643fa6224.jpg`
- DB verification immediately after production:
  - `stories.cover_image_url`: populated with the generated cover URL.
  - `stories.character_designs[0].imageUrl`: populated with the generated character URL.
  - `stories.scene_images`: 2 non-empty generated URLs.
  - `stories.uploaded_images`: `[null, null]`.
  - `stories.production_status`: `completed`.
  - `stories.production_progress`: `100`.

### 2026-04-26 Translation API Call

- Called `/api/story/translate` with the 2 Korean `final_text` pages.
- Response:
  - status: `200`
  - duration: `3.890s`
  - `target_language`: `en`
  - translated page count: `2`
- Persisted the returned translation in the same shape the finish UI saves:
  - `stories.translation_text`: 2 pages.
  - `stories.translated_texts.en`: 2 pages.
- Note: translation was successful, but page 2 translated `다리는 다시 튼튼해졌고` awkwardly as `the legs grew strong again`; this is a translation quality issue, not an API failure.

### 2026-04-26 Publish API / Final DB Verification

- Called `/api/story/publish` from the authenticated browser session.
- Response:
  - status: `200`
  - duration: `809ms`
  - `success`: `true`
  - `completedAt`: `2026-04-26T09:03:25.268Z`
- Final DB verification for story `f27e203c-1b02-436b-b5f6-08f6900ec3a4`:
  - `stories.student_id`: `85647100-73dd-4e3f-8cbb-4534fbb77d8c`
  - `stories.story_status`: `completed`
  - `stories.current_step`: `8`
  - `stories.completed_at`: `2026-04-26T09:03:25.268+00:00`
  - `stories.cover_design.title`: `초록 언덕의 다리`
  - `stories.cover_image_url`: `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/scene-images/2026-04-26/c5e3b267-760a-4c31-b0a8-00cb1fbc7db6.jpg`
  - `stories.character_designs[0].imageUrl`: `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/character-images/2026-04-26/1cb8c1fe-9187-4faf-b885-006f20632c1c.jpg`
  - `stories.scene_images`: 2 generated URLs.
  - `stories.uploaded_images`: `[null, null]`
  - uploaded image count: `0`
  - `stories.production_status`: `completed`
  - `stories.production_progress`: `100`
  - `stories.final_text`: 2 pages.
  - `stories.translation_text`: 2 pages.
  - `stories.translated_texts.en`: 2 pages.
- Final DB verification for library:
  - `library.id`: `557e4d7d-15e7-4b96-8c1b-5b9c1a6b9b9c`
  - `library.story_id`: `f27e203c-1b02-436b-b5f6-08f6900ec3a4`
  - `library.story_title`: `초록 언덕의 다리`
  - `library.author_nickname`: `E2E학생-988230`
  - `library.thumbnail_url`: same generated cover URL as `stories.cover_image_url`
  - `library.likes`: `0`
  - `library.views`: `0`
- Final activity verification:
  - `activities.id`: `5ce191fd-297c-426a-9c1d-0f8216d6736f`
  - `completed_tabs`: `["read", "hidden", "questions", "mystory"]`
  - `stamps_earned`: `["read", "hidden", "questions", "mystory"]`
- `/api/library` GET returned status `200`; the new library item was present with title `초록 언덕의 다리` and the generated cover thumbnail.
- Browser network log for this verification pass showed:
  - `POST /api/story/start` -> `200`
  - `POST /api/story/generate-image` -> `200`
  - `POST /api/story/generate-image` -> `200`
  - `POST /api/story/produce` -> `200`
  - `POST /api/story/translate` -> `200`
  - `POST /api/story/publish` -> `200`
  - `GET /api/library` -> `200`
- Browser console after the pass:
  - errors: `0`
  - warnings: `1`
  - warning: Next.js LCP warning for `/images/countries/tanzania.jpg`; unrelated to the AI API verification.

### 2026-04-26 Result Summary

- Actual AI image generation path succeeded without upload fallback.
- Generated URL count:
  - character sheet: `1`
  - cover image: `1`
  - production scene images: `2`
  - total generated image URLs verified: `4`
- Timings:
  - story start: `0.525s`
  - character image generation: `24.261s`
  - cover image generation: `23.740s`
  - production scene generation: `55.328s`
  - translation: `3.890s`
  - publish: `0.809s`
  - total measured API time: about `108.553s`
- Remaining issues observed in this pass:
  - Translation quality: one English sentence translated the bridge as `legs`.
  - Cover generation with `character_refs` stores the cover image under the `scene-images` storage folder because `/api/story/generate-image` chooses the folder based on reference image presence, not `cover_mode`.
  - Existing unrelated Next.js image LCP warning remains.

## Image Generation Improvement Work

### 2026-04-26 Problem Added By User

- User clarified that `scene_descriptions` are written by children and must affect image generation for the feature to be meaningful.
- Current production path problem:
  - `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts` generates scene prompts from `final_text` only.
  - It ignores `stories.scene_descriptions`, even when students selected "장면을 설명해 주세요" in `/mystory/scenes`.
  - This can produce unrelated art because the student's direct visual instruction is dropped before image generation.
- Required behavior:
  - For each generated page, pass the student's `scene_descriptions[index]` into the image prompt as the authoritative visual direction.
  - Keep `final_text[index]` as narrative context, not the only source.
  - Continue sending character design/reference images, cover design/style reference, selected illustration style, picture-book shape/aspect ratio, and matched character names.
- Model migration requested:
  - Replace active Gemini/Nanobanana image generation with OpenAI `gpt-image-2`.
  - Official reference checked: `https://developers.openai.com/api/docs/guides/image-generation?api=image`.
  - Relevant docs notes: `gpt-image-2` supports common image sizes such as `1024x1024`, `1536x1024`, and `1024x1536`; image input workflows should omit `input_fidelity` because `gpt-image-2` processes inputs at high fidelity automatically; Image API outputs base64 image data.

### 2026-04-26 Implementation Plan

1. Add an OpenAI image wrapper around the installed `openai` SDK:
   - default model: `gpt-image-2`;
   - prompt-only calls use `images.generate`;
   - calls with style/character/cover references use `images.edit` with reference image uploads;
   - map app aspect ratios to OpenAI sizes: `1:1 -> 1024x1024`, `4:3 -> 1536x1024`, `3:4 -> 1024x1536`.
2. Update `/api/story/generate-image` to use the OpenAI wrapper and keep cover images under a cover-specific storage folder when `cover_mode` is true.
3. Update `/api/story/produce` so `scene_descriptions[index]` becomes first-class prompt input:
   - scene description is authoritative;
   - final page text is supporting context;
   - character matching uses both scene description and page text;
   - reference images still include cover style and character designs.
4. Update library thumbnail/viewer fallbacks so uploaded-only stories and generated stories both surface images.
5. Run static validation after the edits and record results here.

### 2026-04-26 Implementation Completed

- Added `/Users/user/task/reading_passport/src/lib/ai/openai-image.ts`.
  - Default active image model is `gpt-image-2`.
  - Prompt-only image generation uses `openai.images.generate`.
  - Reference-image workflows use `openai.images.edit`.
  - App aspect ratios are mapped to `1024x1024`, `1536x1024`, and `1024x1536`.
  - Default output is JPEG with compression to reduce latency/storage size.
  - Reference inputs are capped at 16 images to match the OpenAI image edit input limit.
- Removed the old active Gemini image wrapper file:
  - `/Users/user/task/reading_passport/src/lib/ai/gemini.ts`.
- Updated `/Users/user/task/reading_passport/src/app/api/story/generate-image/route.ts`.
  - Character, scene-preview, and cover image generation now use `generateOpenAIImage`.
  - `cover_mode` images now store under `cover-images` instead of being routed to `scene-images` just because character references were attached.
- Updated `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts`.
  - `stories.scene_descriptions[index]` is now included in the prompt conversion input.
  - Scene description is treated as the primary visual direction.
  - `stories.final_text[index]` remains as story/page context.
  - Character reference matching now checks both scene description and page text.
  - Cover/style reference and character design/reference images are still passed to the image call.
- Updated library image fallbacks:
  - `/Users/user/task/reading_passport/src/app/api/story/publish/route.ts` now uses `uploaded_images` before `scene_images` when no cover image exists.
  - `/Users/user/task/reading_passport/src/app/api/library/route.ts` now selects `uploaded_images` and uses the first uploaded/generated non-empty image for thumbnails.
  - `/Users/user/task/reading_passport/src/app/library/page.tsx` now passes a merged uploaded/generated image array into `BookViewerModal`.
  - `/Users/user/task/reading_passport/src/components/story/LibraryGrid.tsx` now includes `uploaded_images` in the story item type.
- Updated `/Users/user/task/reading_passport/src/app/book/[id]/mystory/creating/CreatingPageContent.tsx` internal production note so it no longer says images ignore `scene_descriptions`.

### 2026-04-26 Validation After Implementation

- `npm run lint` passed.
- `npm run build` passed.
- Real OpenAI API call verification:
  - `generateOpenAIImage` with a reference image hit the `gpt-image-2` edit path successfully.
  - Result summary: `model=gpt-image-2`, `mimeType=image/jpeg`, output bytes `244893`.
  - `generateOpenAIImage` without reference images hit the `gpt-image-2` generate path successfully.
  - Result summary: `model=gpt-image-2`, `mimeType=image/jpeg`, output bytes `147949`.
- Not yet re-run after this implementation:
  - full authenticated student browser flow from character generation -> cover generation -> `/api/story/produce` -> publish -> library visual inspection.
  - That follow-up should verify that the generated images visually follow the saved `scene_descriptions`, not just that the API succeeds.

### 2026-04-26 Targeted Scene Description Reflection Check

- Scope: no code changes; verify that saved `scene_descriptions` are reflected in generated `scene_images` and then appear in the library UI.
- Test student:
  - `student_code`: `988230`
  - `student_id`: `85647100-73dd-4e3f-8cbb-4534fbb77d8c`
- Test story:
  - `story_id`: `a3f4f4b7-4bf4-4739-a3c9-fdea4dbf0067`
  - `title`: `장면설명 반영 확인`
  - page count: `1`
- Test page inputs:
  - `final_text[0]`: `비가 그친 뒤 아미나는 마을 사람들이 다시 건널 수 있도록 작은 다리 옆에 섰어요. 노란 우산을 든 아미나는 친구들을 기다리며 용기를 냈어요.`
  - `scene_descriptions[0]`: `아미나가 밝은 빨간 우비를 입고 노란 우산을 들고 파란색 나무다리 옆에 서 있는 장면. 뒤에는 초록 언덕과 작은 마을이 보인다.`
  - `uploaded_images[0]`: `null`
  - `cover_design.picture_book_shape`: `landscape_4_3`
  - `illustration_style`: `watercolor`
- Called `/api/story/produce` from an authenticated Playwright browser session as student `988230`.
- DB result after production:
  - `production_status`: `completed`
  - `production_progress`: `100`
  - `scene_images[0]`: `https://ttzstncplgzkbnlhepgh.supabase.co/storage/v1/object/public/generated-images/scene-images/2026-04-26/fa6a70ba-d135-43b3-88c5-a972851a8ef7.jpg`
- Downloaded generated image to:
  - `/Users/user/task/reading_passport/output/scene-reflect/a3f4f4b7-page1.jpg`
  - file info: JPEG, `1536x1024`, `308KB`
- Visual inspection result:
  - Scene description was reflected well.
  - Generated image includes a child in a bright red raincoat, yellow umbrella, blue bridge, green hills, and a small village.
  - This validates that `scene_descriptions[0]` is making it into the generated image behavior for this case.
- Published the test story through `/api/story/publish`.
- DB library result:
  - `library.id`: `a1498791-2280-4884-95b1-6de746afc157`
  - `library.story_title`: `장면설명 반영 확인`
  - `library.thumbnail_url`: same generated `scene_images[0]` URL.
- Browser library UI result:
  - `/library` showed card `장면설명 반영 확인`.
  - Card thumbnail rendered.
  - Clicking the card opened `BookViewerModal`.
  - Viewer page `1 / 1` rendered `img alt="장면 1"` and displayed the page text.
- Console during library check:
  - No blocking errors observed.
  - Existing unrelated Next.js LCP warning for `/images/countries/tanzania.jpg` still appears.

### 2026-04-26 Page/Image Count Limit Check

- Scope: no code changes; verify whether the student story image/page count is capped at 6 in the current UI.
- Code findings:
  - `/Users/user/task/reading_passport/src/app/api/story/generate-draft/route.ts` asks AI to produce exactly 5 draft scenes.
  - `/Users/user/task/reading_passport/src/app/book/[id]/mystory/draft/DraftPageContent.tsx` keeps at least 5 pages and blocks adding beyond 6 pages.
  - `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts` has no explicit hard-coded 6-page cap; it generates for each non-empty `final_text` page without an uploaded image. In normal UI flow, `final_text` is constrained to 5-6 pages by the draft screen.
- Browser check:
  - Created temporary draft story `1ea5182d-6ff4-4d22-a410-2abf821cb39a` with 5 `ai_draft` pages for student `988230`.
  - Opened `/mystory/draft` as student `988230`.
  - Initial UI showed `+ 페이지 추가 (5/6)`.
  - After clicking page add, a `#6 장면 6` page appeared.
  - The page-add button disappeared at 6 pages.
  - The progress text showed `5/6 페이지 작성 완료` because the added sixth page was intentionally left blank for this check.
- Cleanup:
  - Temporary draft story `1ea5182d-6ff4-4d22-a410-2abf821cb39a` was archived after the check.
  - Playwright session `max-pages` was closed.

### 2026-04-26 Cleanup

- Closed the Playwright browser session used for this pass.
- Playwright CLI session list after cleanup: no browsers.
- No new dev server was started by this pass; the pre-existing port 3000 `next-server` process was left running.

## Observations / Working Well

- The codebase now has a dedicated `/api/story/publish` endpoint that marks stories completed, upserts library metadata, and awards the My World stamp.
- My World is represented as an 8-step route helper with explicit steps for chat, draft, scenes, characters, style, creating, and complete.
- Library comment eligibility is tied to reading completion for a selected story, which matches the requested "read then comment" behavior.
- DB connectivity is healthy via service role and anon checks; RLS allows the approved global book to appear to unauthenticated anon reads used by the check script.
- Student 6-digit-code model is straightforward to seed for validation because student login only needs the `users.student_code` profile and matching Supabase auth user.
- Student login and map routing worked cleanly for the new account.
- Step 1 read completion persisted correctly in `activities`, including emotion, one-line impression, read question seed, completed tab, and read stamp.
- The PDF viewer correctly surfaced the completion CTA only after reaching the last page.
- Hidden Stories progress and challenge-note persistence worked end to end. The UI correctly gated the hidden stamp until all 4 content items were read and all 4 challenge records were saved.
- Link content gives a clear in-app panel after opening the external tab, which helps students return to the challenge step.
- Step 3 correctly reused Step 1 and Step 2 artifacts as question seeds, which made the flow feel connected instead of isolated.
- Step 3 persisted both local progress (`activities`) and shared board state (`question_posts`) after one submit.
- World Smart correctly scoped the visible board to the same teacher/class and included both the new E2E student and the existing seeded student.
- My World chat validation worked as intended after the configured 5 student turns.
- AI draft generation produced a coherent 5-page draft and page-level rewrite advice from the student chat input.
- The draft page correctly enforced the minimum 5 filled pages before allowing the scene step.
- Scene image upload worked through the browser file chooser and persisted enough data for production to skip external image generation.
- Character generation is optional; text-only character setup is enough to continue, which is useful for classrooms with limited time.
- Cover image skip worked, and production/share still completed successfully.
- Publishing correctly completed the story, registered it in `library`, and awarded the fourth `mystory` stamp.
- Library listing surfaced the new shared story to both the author account and a different student account.
- Library read-progress tracking worked for the second student and saved completion to `story_read_progress`.

## Errors And Blockers

- Potential data mismatch: the available DB book is country `rwanda` with title `Who is a real hero?`; Tanzania seed-specific checks return no Tanzania book. Continue with the current DB book unless this becomes a UI/content issue.
- Automation note, not app bug: running two Playwright fill commands in parallel caused both strings to land in the first textarea. Re-filled the Step 1 fields sequentially and the UI state became correct.
- External PDF embed blocker: `르완다 나라 소개 자료` uses a `www.unicef.org` PDF URL that refuses iframe embedding. The app still lets the timer complete, but students cannot actually read the PDF in-app.
- Video requirement mismatch: the video card badge says `80%`, but the actual completion overlay uses `0초`, allowing immediate completion without watching 80%.
- External link tab remains open after the link content step. This is expected browser behavior but can clutter test sessions; close or ignore tab 1 if it interferes with later automation.
- Automation note, not app bug: the Playwright CLI used in this environment does not support a `wait` command. Use shell `sleep` before the next `snapshot` when a route needs time to settle.
- My World scene-step behavior mismatch: the UI offers `비워두기` with text saying the page can be left without an image, but `/api/story/produce` treats every non-empty `final_text` page without an uploaded image as an image-generation task. This means "비워두기" does not actually prevent later image generation.
- My World AI generation latency: draft generation took roughly 40 seconds in this test. It completed, but the user sees only a loading state during that time.
- My World guide-chat model behavior: several `gpt-5-nano` guide-chat calls returned empty content because the response hit the token limit. The UI fallback prevented a hard failure, but the assistant responses became short/generic.
- Scene upload automation note, not app bug: after multiple upload choices were opened, selecting `+ 파일 선택하기` by accessible text was ambiguous in Playwright. Using the fresh element refs from the snapshot completed uploads correctly.
- Cross-student comment blocker: after a non-author student completed reading, inserting into `story_comments` still returned `403`. Either the deployed DB RLS policy does not include the completed-reader insert policy, or a later policy/migration state is overriding the intended behavior.
- Comment false-positive UI: `handleSubmitComment` does not inspect the Supabase insert response for `error`. It clears the input and increments the local card comment count even when the insert fails. The open comment panel then remains at `감상 (0)`, producing an inconsistent state.

## Next Work

1. Run one authenticated student My World production after the `gpt-image-2` migration:
   - character generation;
   - cover generation with character refs;
   - scene production with non-empty `scene_descriptions`;
   - publish;
   - library viewer check.
2. Optional broader visual QA: repeat scene-description comparison on a multi-page story with multiple named characters and character reference images.
3. Fix and re-test cross-student comment insertion.
4. Verify the comment panel refreshes to show the new comment and that the card count matches the persisted DB count.
5. Re-run a targeted `/library` comment check after the comment fix.

## References For Next AI

- `/Users/user/task/reading_passport/src/app/api/teacher/students/route.ts` - if UI creation is cumbersome, this route shows the teacher-authenticated API shape for bulk student creation.
- `/Users/user/task/reading_passport/src/lib/queries/teacher.ts` - source of truth for `bulkCreateStudents`, generated internal email, and student code generation.
- `/Users/user/task/reading_passport/src/app/login/actions.ts` - student login uses `student_code` lookup and Supabase magic-link OTP verification.
- `/Users/user/task/reading_passport/src/components/book/PictureBookViewer.tsx` - PDF viewer last-page behavior for triggering Step 1 completion.
- `/Users/user/task/reading_passport/src/components/book/ExplorePageClient.tsx` - Hidden Stories completion requires each content item to be viewed and have a challenge note saved.
- `/Users/user/task/reading_passport/src/app/book/[id]/questions/QuestionsPageContent.tsx` - Step 3 submit flow saves questions, validates, syncs World Smart, then awards stamp.
- `/Users/user/task/reading_passport/src/app/api/story/publish/route.ts` - publishing path for library share and mystory stamp.
- `/Users/user/task/reading_passport/src/app/library/page.tsx` - comment/read-progress interaction after a story appears in the library.
- `/Users/user/task/reading_passport/src/lib/ai/openai-image.ts` - active `gpt-image-2` wrapper for prompt-only and reference-image generation.
- `/Users/user/task/reading_passport/src/app/api/story/generate-image/route.ts` - character/cover/preview image endpoint using the OpenAI image wrapper.
- `/Users/user/task/reading_passport/src/app/api/story/produce/route.ts` - production scene generation; read `convertTextToImagePrompt` and `generateSceneImageForPage` for scene-description priority.
- `https://developers.openai.com/api/docs/guides/image-generation?api=image` - official OpenAI image-generation guide used for `gpt-image-2` migration details.

## Open Questions

- Whether the connected Supabase project has the intended `story_comments` completed-reader insert policy applied. The table and `story_read_progress` row exist, but cross-student comment insert still returned `403`.
- Whether the app should submit library comments through a service-role API route, similar to `/api/library/read-progress`, to avoid fragile client-side RLS behavior.
- Whether `비워두기` in the scene step should truly skip image generation, or be relabeled to make clear that the production step may still generate an image.

## Resume Notes

- Resume by reading the latest `Progress Log`, then run the next unchecked `Next Work` item.
- Keep this document updated after every major browser step.
