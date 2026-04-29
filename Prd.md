# World Stories / World Docent — 개발 PRD

> 글로벌 독서교육 웹앱 / 솔로 개발 / 무료 교육용
> 최초 작성: 2026.04 / 로컬 코드 기준 갱신: 2026.04.27
> 기준 소스: `/Users/user/task/reading_passport` 로컬 폴더

---

## 0. 로컬 코드 기준 변경 요약

현재 로컬 구현은 초기 PRD와 아래 지점이 달라졌다. 이 문서는 로컬 코드 상태를 우선 기준으로 한다.

| 영역 | 기존 PRD | 현재 로컬 코드 |
|------|----------|----------------|
| 서비스명 | World Docent 중심 | UI 브랜드는 `World Stories`, 프로젝트 맥락은 World Docent 병행 |
| 핵심 활동 | Story Read / Hidden Stories / Talk with Character / My Story | `Story Read` / `Hidden Stories` / `질문 만들기` / `My World` 4도장 |
| Step 3 | 캐릭터 대화 도장 | 질문 만들기 완료 후 `World Smart` 질문게시판으로 확장 |
| `/book/[id]/chat` | 핵심 도장 흐름 | 레거시/보조 라우트로 남아 있음. 현재 4도장 완료 조건에는 포함하지 않음 |
| My World | `/mystory/write` 자유 작성 단계 포함 | 자유 작성 단계 제거. 작가 도슨트 대화 → 활동 선택 → 토리 질문 카드 → AI 초안 → 학생 재작성 흐름 |
| My World Step 1 | 토리와 자유 채팅 (`guide-chat` API) | 작가 도슨트 양방향 채팅 → 활동 추천 3개 → 활동 선택 → 토리 질문 카드(활동별 3~5장) 답변 → 초안 생성. 토리는 더 이상 양방향 채팅이 아님 (`guide-chat` API 삭제됨) |
| My World 라우트 | `/mystory/write`, `/finish` 중심 | `/mystory`, `/draft`, `/scenes`, `/characters`, `/style`, `/creating`, `/finish`, `/complete` |
| My World 페이지 수 | 기본 3장, 최대 6장 | AI 초안은 5장면 고정, 학생은 최소 5장 작성, 최대 6장 |
| 이미지 AI | Nanobanana2 | OpenAI 이미지 API, 기본 모델 `gpt-image-2`, 환경변수 `OPENAI_IMAGE_MODEL`로 대체 가능 |
| 언어 | 한국어/영어 중심 | `pdf_urls` 기반 다국어. 현재 지원 목록: ko, en, vi, zh, ja, es, fr, ar, sw, hi |
| 도서 분석 | books 컬럼 직접 저장 일부 | `book_pdf_texts`, `book_analyses` 분리 |
| Hidden Stories | 탐색 완료만 저장 | 자료별 열람 조건 + `자료 한 줄 정리` + `새로 생긴 궁금증` 저장 후 도장 |
| 서재 | 공개/비밀 중심 | `library` 메타데이터, 뷰어, 좋아요, 읽기 완료 후 댓글, 공개 범위 관리 |
| 추가 기능 | 없음 | 캠페인 보드, 마이페이지, 여권, 세계 상식 관리, World Smart 관리 패널 |

---

## 1. 프로젝트 개요

### 한 줄 정의

제3세계 그림책을 읽고, 배경 세계를 탐색하고, 질문을 만들고, 자신만의 그림책을 완성하는 디지털 독서 여권 웹앱.

### 핵심 철학

AI가 정답을 대신 주기보다 학생이 읽고, 묻고, 상상하고, 다시 쓰게 만든다.

### 기술 스택

- 프레임워크: Next.js App Router (`next@16.2.2`)
- UI: React 19, Tailwind CSS 4, Framer Motion, lucide-react
- DB/인증/스토리지: Supabase
- 배포: Vercel
- 텍스트 AI: OpenAI `gpt-5-mini`, `gpt-5-nano`
- 이미지 AI: OpenAI 이미지 API, 기본 `gpt-image-2`
- PDF: `pdfjs-dist`

---

## 2. 전체 사용자 흐름

```text
홈 /
  ↓
로그인 /login
  ├─ 교사/관리자: 이메일 + 비밀번호
  └─ 학생: 6자리 코드
  ↓
국가/책 선택 /map
  ↓
언어 선택 → 책 소개 /book/[id]
  ↓
활동 선택 /book/[id]/activity
  ├─ Step 1 Story Read       /book/[id]/read
  ├─ Step 2 Hidden Stories   /book/[id]/explore
  ├─ Step 3 질문 만들기       /book/[id]/questions
  │     └─ 완료 후 World Smart /book/[id]/world-smart
  └─ Step 4 My World         /book/[id]/mystory
        ├─ 작가 도슨트 대화 → 활동 추천 3개 → 활동 선택
        ├─ 토리 질문 카드 (활동별 3~5장) → 답변 저장
        ├─ /draft      AI 초안(5장면) 기반 재작성
        ├─ /scenes     장면 상상/업로드
        ├─ /characters 주인공 설정 + 스타일
        ├─ /style      표지 디자인 + 판형
        ├─ /creating   이미지 제작 대기
        ├─ /finish     완성본 편집/번역/공개 설정
        └─ /complete   최종 확인/공유/PDF 다운로드
  ↓
도서관 /library, 여권 /passport, 마이페이지 /mypage
```

---

## 3. 권한 구조

| 권한 | 관리자 | 교사 | 학생 |
|------|--------|------|------|
| 이메일/비밀번호 로그인 | 가능 | 가능 | 불가 |
| 6자리 코드 로그인 | 불가 | 불가 | 가능 |
| 도서 전역 등록/수정 | 가능 | 승인 요청 또는 반 범위 | 불가 |
| Hidden Stories 관리 | 전역 관리 | 담당 반/승인 요청 | 불가 |
| 학생 계정 발급 | 가능 | 담당 학생 | 불가 |
| 질문 게시판 관리 | 전체 | 담당 반 | 본인 질문/답변 |
| 캠페인 생성 | 가능 | 가능 | 불가 |
| 캠페인 참여 | 가능 | 가능 | 가능 |
| My World 창작 | 불가 | 불가 | 가능 |
| 서재 공개 범위 변경 | 전체 | 담당 학생 작품 | 본인 작품 |

### 로그인/계정 흐름

```text
관리자 계정
  ↓
관리자가 교사 계정 생성/관리
  ↓
교사가 학생 계정 일괄 발급
  ↓
학생은 6자리 코드로 로그인
  ↓
닉네임/아바타가 없으면 자동 닉네임을 보완하거나 온보딩에서 설정
```

현재 코드의 학생 로그인은 Supabase service role로 학생 코드를 조회한 뒤 magic link OTP 세션을 생성한다.

---

## 4. 실제 라우트 구조

### 공통/학생

```text
/
/login
/onboarding
/map
/book/[id]
/book/[id]/activity
/book/[id]/read
/book/[id]/explore
/book/[id]/questions
/book/[id]/world-smart
/book/[id]/chat              # 레거시/보조 캐릭터 대화
/book/[id]/mystory
/book/[id]/mystory/draft
/book/[id]/mystory/scenes
/book/[id]/mystory/characters
/book/[id]/mystory/style
/book/[id]/mystory/creating
/book/[id]/mystory/finish
/book/[id]/mystory/complete
/library
/passport
/mypage
/campaign
/campaign/[id]
/campaign/[id]/submit
/guide/prompt-tips
/guide/character-tips
```

### 교사/관리자

```text
/teacher
/admin
/campaign/create
```

`proxy.ts` 기준으로 `/book/[id]/activity|read|explore|questions|world-smart|mystory`와 `/passport`는 학생 전용이다.

---

## 5. 언어 선택 구조

책은 `books.pdf_urls` 맵과 `languages_available` 배열을 기준으로 언어 선택지를 만든다.

```ts
pdf_urls: {
  ko?: string;
  en?: string;
  vi?: string;
  zh?: string;
  ja?: string;
  es?: string;
  fr?: string;
  ar?: string;
  sw?: string;
  hi?: string;
}
```

`pdf_url_ko`, `pdf_url_en`은 타입에 남아 있지만 deprecated 필드다. 새 구현은 `pdf_urls`를 우선 사용한다.

언어 선택은 책 PDF, 질문 활동, My World 채팅/초안/번역 흐름에 영향을 준다. UI 기본 언어는 한국어다.

---

## 6. 핵심 활동과 도장

책 1권 기준 도장은 4개다.

| 도장 | 라우트 | 획득 조건 |
|------|--------|-----------|
| `read` | `/book/[id]/read` | PDF 마지막까지 읽고 감정/한줄 감상/질문 씨앗 저장 |
| `hidden` | `/book/[id]/explore` | 모든 Hidden Story 자료 열람 + 자료별 챌린지 기록 |
| `questions` | `/book/[id]/questions` | 필수 질문 수 충족 + AI 질문 검증 통과 + World Smart 동기화 |
| `mystory` | `/book/[id]/mystory/*` | 완성본 공유 시 `story_status=completed`, library 등록 |

My World는 앞의 세 도장(`read`, `hidden`, `questions`)을 모두 얻은 뒤 진입 가능하다.

---

## 7. 페이지별 요구사항

### 7-1. 홈 (`/`)

- 비디오 기반 히어로를 사용한다.
- 서비스명은 UI에서 `World Stories`로 노출한다.
- 네 가지 활동, 국가 캐러셀, 여권 쇼케이스, 시작 CTA를 제공한다.

### 7-2. 로그인 (`/login`)

- 학생 탭: 6자리 코드 입력.
- 교사 탭: 이메일/비밀번호 입력.
- 관리자 계정도 교사 탭에서 로그인하며 role에 따라 `/admin`으로 이동한다.

### 7-3. 국가/책 선택 (`/map`)

- 국가 카드 그리드와 세계지도 섹션을 함께 제공한다.
- 국가별 책 수, 진행 중 책 수, 완료 책 수를 보여준다.
- 책 클릭 시 언어 선택 모달을 연다.
- 이어하기 배너로 진행 중 도서를 다시 열 수 있다.

### 7-4. 책 소개 (`/book/[id]`)

- 표지, 제목, 국가 정보, 도장 현황 0/4~4/4를 보여준다.
- `탐험 시작하기`로 활동 선택 화면에 진입한다.

### 7-5. 활동 선택 (`/book/[id]/activity`)

- 3개 메인 카드: Story Read, Hidden Stories, 질문 만들기.
- 질문 도장 획득 후 `World Smart` 버튼이 열린다.
- `My World` 카드는 항상 보이지만 앞의 3도장 완료 전에는 잠금 상태다.

### 7-6. Story Read (`/book/[id]/read`)

- 선택 언어의 PDF를 그림책 뷰어로 연다.
- 마지막 페이지 도달 후 감정, 한 줄 감상, 질문 씨앗을 받는다.
- `/api/activities/read-complete`가 `activities`의 `read_question_seed`, `emotion`, `one_line`, `read` 도장을 저장한다.

### 7-7. Hidden Stories (`/book/[id]/explore`)

- 교사/관리자가 등록한 영상, PDF, 이미지, 링크 카드 피드.
- 열람 조건:
  - 이미지: 10초
  - PDF: 60초
  - 링크: 열기
  - 영상: 콘텐츠 카드 기준 진행 처리
- 자료별로 `자료 한 줄 정리`, `새로 생긴 궁금증`을 저장한다.
- 모든 자료를 열람하고 모든 챌린지를 기록해야 `hidden` 도장을 획득한다.
- 교사는 `hidden_content_class_overrides`로 담당 반에서 특정 전역 자료를 숨길 수 있다.

### 7-8. 질문 만들기 (`/book/[id]/questions`)

- 카테고리: 이야기, 인물, 세계(배경).
- 각 카테고리 최대 3개 질문.
- 필수 총 질문 수는 `classes.questions_required_count`로 설정하며 4~11개 사이로 보정된다. 단, 카테고리별 최대 3개 제한 때문에 실제 배분 가능한 필수 질문은 최대 9개다.
- 기본 분배는 각 카테고리 1개 이상이고, 추가 필수 수는 이야기 → 인물 → 세계 순으로 분배한다.
- 제출 시 `/api/story/validate-questions`로 질문 품질을 검증한다.
- 검증 결과는 질문별 피드백 카드로 보여준다.
- 통과 시 `chat_logs.chat_type='questions'`에 저장하고 `/api/world-smart/sync`로 질문 게시글을 만든다.
- 완료 후 `/book/[id]/world-smart?posted=1`로 이동한다.

### 7-9. World Smart (`/book/[id]/world-smart`)

- 질문 만들기 결과가 책/반 단위 질문 게시판으로 올라간다.
- 탭: 전체, 이야기, 인물, 세계.
- 정렬: 최신순, 인기순, 채택 대기.
- 다른 학생은 질문에 댓글을 남길 수 있다.
- 질문 작성자는 마음에 드는 댓글을 채택할 수 있다.
- 채택 완료 질문에는 새 댓글을 받지 않는다.
- 내 질문은 채택 전 수정/삭제할 수 있다.
- 마이페이지에서 채택된 답변 수와 World Smart 배지를 확인한다.
- 교사/관리자는 관리 패널에서 질문과 답변을 확인하고 답변 숨김/해제 등 moderation을 수행한다.

### 7-10. My World 단계

`current_step`은 레거시 DB 값을 유지한다. 학생에게 보이는 단계는 7개 진행 단계 + 최종 완성 확인이다.

| current_step | 라우트 | 학생 화면 |
|--------------|--------|----------|
| 1 | `/mystory` | 작가 도슨트 대화 → 활동 선택 → 토리 질문 카드 |
| 3 | `/mystory/draft` | 이야기 바꿔 쓰기 |
| 4 | `/mystory/scenes` | 장면 상상하기 |
| 5 | `/mystory/characters` | 주인공 설정 |
| 6 | `/mystory/style` | 표지 디자인 |
| 7 | `/mystory/creating` 또는 `/finish` | 그림책 제작/제작본 편집 |
| 8 | `/mystory/complete` | 완성하기 |

#### Step 1: 작가 도슨트 대화 → 활동 선택 → 토리 질문 카드 (`/book/[id]/mystory`)

세 phase가 한 라우트 안에서 순차적으로 진행된다 (`MyStoryPhase`: `'docent' → 'activity' → 'chat' → 'kicked'`).

**Phase 1 — 작가 도슨트 양방향 대화**
- 책의 작가 페르소나로 응답하는 양방향 챗봇. 모델: `gpt-5-mini` (`/api/story/docent-chat`).
- 최대 10턴까지 대화 가능. 도슨트 페르소나는 1인칭 작가 시점, 책 원문/분석을 컨텍스트로 받는다.
- 학생의 Step 1 한 줄 감상, Step 1 질문 씨앗, Step 2 자료 탐색 메모, Step 3 질문 게시글이 prior context로 함께 들어간다.
- 대화 로그는 `stories.docent_chat_log`에 저장된다.
- 부적절한 내용은 `chat_logs.chat_type='story_gauge'` 스냅샷으로 플래그 검사한다.

**Phase 2 — 활동 추천 3개 + 학생 선택**
- 10턴이 끝나면 `/api/story/docent-recommendations`가 12개 활동 후보 중 학생 대화에 가장 잘 맞는 3개를 골라 반환한다 (모델: `gpt-5-mini`).
- 12개 활동: `continue_story`, `change_ending`, `change_main_character`, `side_character_story`, `change_choice`, `before_story`, `hidden_scene_story`, `same_message_new_story`, `change_setting`, `opposite_perspective`, `new_problem_story`, `new_helper_story`.
- 학생은 추천 3개 중 1개를 고르거나 자유롭게 직접 활동을 적을 수 있다 (이 경우 `_custom`으로 처리됨).
- 추천 결과는 `stories.docent_recommendations`에, 학생 선택은 `stories.selected_activity`에 저장된다.

**Phase 3 — 토리 질문 카드**
- 학생이 고른 활동에 따라 활동별로 다른 3~5장의 카드 세트가 표시된다. 카드 정의는 `src/lib/tori-questions.ts` (12 활동 + `_custom` 폴백).
- 각 카드 = [질문 + 힌트 예시(클릭 불가, 회색 텍스트) + 자유 입력란]. 카드별 `required` 플래그가 모두 채워져야 다음으로 진행 가능.
- 질문 문구는 `${country}` (책의 country를 한글 표시명으로 치환), `${protagonist}` (현재는 "주인공" 폴백) 변수 치환 지원. 어느 책/나라에서도 같은 카드 세트가 작동한다.
- 토리는 더 이상 양방향 AI 채팅이 아니다. 카드 답변 단계에서는 AI 호출 0번. 답변은 `stories.tori_answers`(JSONB: `{activity_id, answers: {key: value}}`)에 자동 저장된다.
- 마지막 카드까지 답하면 `/api/story/generate-draft`가 5장면 초안을 생성한다.

#### Step 2: 이야기 바꿔 쓰기 (`/book/[id]/mystory/draft`)

- AI 초안과 조언을 왼쪽에 보여주고, 학생이 오른쪽에 자기 문장으로 다시 쓴다.
- 초안은 정확히 5장면: 발단, 전개, 위기, 절정, 결말.
- 학생 작성은 최소 5장면을 채워야 다음 단계로 이동한다.
- 최대 6장면까지 추가할 수 있다.
- `final_text`에 자동 저장한다.

#### Step 3: 장면 상상하기 (`/book/[id]/mystory/scenes`)

- 각 장면별 선택지: 직접 그린 이미지 업로드, 장면 설명, 건너뛰기.
- 업로드는 JPG/PNG, 5MB 이하.
- `uploaded_images`, `scene_descriptions`를 저장한다.

#### Step 4: 주인공 설정 (`/book/[id]/mystory/characters`)

- 그림 스타일을 먼저 선택한다.
- 지원 스타일: 수채화, 거친 드로잉, 파스텔, 콜라주, 판화, 카툰앤코믹, 일본 애니메이션, 2D 치비캐릭터, 캐리커처, 스톱모션 미니어처, 3D 클레이아트, 3D 애니메이션.
- 주인공은 최대 3명.
- 이름, 성별, 외형, 성격을 입력한다.
- 캐릭터 시트 이미지는 `/api/story/generate-image`로 생성하고 `character_designs`에 저장한다.

#### Step 5: 표지 디자인 (`/book/[id]/mystory/style`)

- 제목, 글쓴이, 그림책 형태를 설정한다.
- 판형: 가로형 4:3, 세로형 3:4, 정사각형 1:1.
- 표지 이미지 선택지: 직접 업로드, 설명 후 생성, 이미지 없이 진행.
- 설명 후 생성 모드는 먼저 표지 이미지를 생성해야 다음 단계로 이동한다.
- 표지 생성 시 캐릭터 이름이 설명에 포함되면 해당 캐릭터 레퍼런스를 우선 사용한다.

#### Step 6: 그림책 제작 (`/book/[id]/mystory/creating`)

- `/api/story/produce`가 서버에서 이미지 제작을 시작한다.
- `after()`를 사용해 백그라운드 작업으로 전환한다.
- 장면 이미지는 최대 5개 동시 생성으로 처리한다.
- 학생 업로드 이미지가 있는 장면은 AI 생성에서 제외한다.
- 제작 상태는 `production_status`, `production_progress`, `production_heartbeat_at`, `production_error_message`에 저장한다.
- 화면은 30초 간격으로 진행률을 폴링하고, 나라 상식 카드를 5초마다 전환한다.
- watchdog은 오래 멈춘 제작 상태를 복구 대상으로 판단한다.

#### Step 7: 제작본 편집 (`/book/[id]/mystory/finish`)

- 표지, 장면 이미지, 텍스트를 책 넘김 형태로 확인한다.
- 텍스트는 계속 수정할 수 있고 자동 저장된다.
- 글꼴과 글자 크기를 선택할 수 있다.
- 영어 번역은 한국어 원본 기준 자동으로 준비하며, 다른 언어 번역도 추가할 수 있다.
- AI 생성 장면은 개별 재생성할 수 있다. 학생 업로드 이미지는 이 화면에서 재생성하지 않는다.
- 공개 범위는 `public` 또는 `secret`이다.
- 최종 확인 단계로 이동하면 `/mystory/complete`로 간다.

#### Step 8: 완성하기 (`/book/[id]/mystory/complete`)

- 원본 그림책과 번역본 다운로드 상태를 확인한다.
- 원본/번역본 PDF 다운로드는 브라우저 print 기반으로 제공한다.
- `도서관에 공유하기`를 누르면 `/api/story/publish`가 실행된다.
- publish 결과:
  - `stories.story_status='completed'`
  - `stories.completed_at` 저장
  - `library` row 생성/업데이트
  - `activities`에 `mystory` 도장 추가

---

## 8. 도서관, 여권, 마이페이지

### 도서관 (`/library`)

- 구조: 국가 → 원작 책 → 학생 작품.
- 공개 작품은 로그인 사용자에게 노출한다.
- 비밀 작품은 작성자, 담당 교사, 관리자에게만 노출한다.
- 작품 뷰어에서 마지막 페이지까지 읽으면 `story_read_progress.completed=true`로 기록한다.
- 좋아요는 로그인 사용자가 사용할 수 있다.
- 댓글은 타인 작품을 끝까지 읽은 사용자만 작성할 수 있다.

### 여권 (`/passport`)

- 학생 전용 라우트.
- 국가별로 4도장 상태를 보여준다.
- 4도장이 모두 있으면 해당 국가 여권 페이지를 완료 상태로 표시한다.

### 마이페이지 (`/mypage`)

- 학생: 통계, 진행 중 My World 초안, 완성 작품, World Smart 배지/질문, 프로필 수정.
- 교사: 담당 학생 수, 활동 학생, 완성 작품, 플래그 대화 수, 프로필 수정.
- 학생은 본인 작품의 공개 범위를 관리할 수 있다.

---

## 9. 캠페인

### 사용자 흐름

```text
/campaign
  ├─ 캠페인 목록/필터
  ├─ /campaign/[id] 상세/제출물
  └─ /campaign/[id]/submit 학생 제출

/campaign/create
  └─ 교사/관리자 캠페인 생성
```

### 기능

- 교사/관리자가 캠페인을 만든다.
- 상태: draft, active, closed.
- 범위: class, global.
- 제출 유형: poster, card_news, impression, culture_intro, worksheet, other.
- 제출 파일: 이미지 또는 PDF.
- 캠페인별 최대 파일 수와 최대 파일 크기를 설정한다.
- 학생은 캠페인당 한 번 제출한다.
- 제출물은 좋아요를 받을 수 있고, 교사/관리자가 featured/hidden 상태를 관리한다.
- 마감 시간이 지난 캠페인은 참여 접수를 닫는다.

---

## 10. 교사 대시보드 (`/teacher`)

탭 구조:

- 반 전체 현황: 학생별 활동, 도장 수, 플래그 여부.
- 질문 게시판: World Smart 질문/답변 관리.
- 계정 관리: 학생 계정 발급/관리.
- 책/자료 관리: 도서, PDF, 표지, Hidden Stories CRUD, 승인 요청.
- 도서관 관리: 담당 학생 작품 관리.
- 캠페인: 캠페인 생성/상태 변경/제출물 확인.
- 반 설정: My World 검증 시작 턴 수, 질문 필수 수.

교사 도서/자료 관리는 `scope='class'`면 즉시 반에 배포하고, `scope='global'`이면 승인 요청 흐름을 탄다.

---

## 11. 관리자 페이지 (`/admin`)

탭 구조:

- 운영 현황
- 교사 관리
- 승인 검토
- 도서 관리
- 질문 게시판
- Hidden Stories
- 서재 관리
- 세계 상식

관리자는 전역 도서/Hidden Stories를 직접 관리하고, 교사 요청을 승인/반려하며, 세계 상식과 서재 노출을 운영한다.

---

## 12. DB 구조

핵심 테이블과 현재 의미는 아래와 같다.

```text
users
  id, email, role, school, grade, class
  nickname, avatar, student_code, teacher_id

classes
  id, teacher_id, class_code, school, grade, class_name
  mystory_required_turns
  questions_required_count

books
  id, country_id, title, cover_url
  pdf_urls
  pdf_url_ko, pdf_url_en                 # deprecated
  languages_available
  created_by, scope, class_id, approved

book_pdf_texts
  book_id, extraction_type, source_language, source_pdf_url, source_hash
  status, extracted_text, extracted_text_chars, error_message

book_analyses
  book_id, analysis_type, source_language, source_pdf_url, source_hash
  status, model, prompt_version, analysis_json, extracted_text_chars, error_message

hidden_content
  book_id, country_id, type, title, url, order
  created_by, scope, class_id, approved

hidden_content_class_overrides
  hidden_content_id, teacher_id, class_id, hidden

activities
  student_id, book_id, country_id, language
  emotion, one_line, read_question_seed
  explore_challenges
  completed_tabs, stamps_earned

chat_logs
  student_id, book_id, character_id, character_name
  chat_type: character | story_gauge | questions
  messages, language, flagged, ended_at

question_posts
  book_id, student_id, teacher_id, class_name
  chat_log_id, question_type, question_text
  adopted_answer_id

question_answers
  post_id, student_id, answer_text
  moderation_status, moderated_by, moderated_at, moderation_reason

question_moderation_logs
  target_type, target_id, action, moderator_id, moderator_role, reason

stories
  student_id, book_id, country_id, language
  story_status: draft | completed | archived
  story_type, custom_input
  current_step

  # Step 4 작가 도슨트 (migration 032)
  docent_chat_log               # 도슨트와의 양방향 대화 로그
  docent_recommendations        # AI가 고른 활동 추천 3개
  selected_activity             # 학생이 선택한 활동 (id, title, description, starter)

  # Step 4 토리 질문 카드 (migration 034)
  tori_answers                  # { activity_id, answers: {key: value} }

  # 작가의 방향 사이드바 (`/mystory/creating`, migration 033)
  purpose_answers               # { reader, message, reason }

  # Legacy 호환 필드 (현재 흐름에선 사용하지 않음)
  chat_log, all_student_messages
  guide_answers, student_freewrite

  # 초안/제작
  ai_draft, final_text
  uploaded_images, scene_descriptions, scene_images
  character_designs, character_refs
  illustration_style
  cover_design, cover_image_url
  production_status, production_progress
  production_started_at, production_heartbeat_at, production_error_message
  translation_text, translated_texts
  pdf_url_original, pdf_url_translated, translated_pdf_urls
  visibility: public | secret
  started_at, completed_at, created_at

country_facts
  country_id, fact_text, fact_text_en, order

library
  story_id, country_id, book_id
  story_title, author_nickname, thumbnail_url
  likes, views

story_likes
  story_id, user_id

story_read_progress
  story_id, user_id, last_page, total_pages_snapshot, completed, completed_at

story_comments
  story_id, user_id, content

approval_requests
  requester_id, content_type, content_id
  status, reviewer_id, review_note
  content_title, content_scope, reviewed_at

campaigns
  title, description, cover_image_url
  allowed_content_types, tags, status, deadline
  max_files_per_submission, max_file_size_mb
  created_by, class_id, scope

campaign_submissions
  campaign_id, student_id, content_type, title, description, assets, status

campaign_likes
  submission_id, user_id
```

---

## 13. 주요 API

| 영역 | API |
|------|-----|
| 읽기 완료 | `POST /api/activities/read-complete` |
| 질문 검증 | `POST /api/story/validate-questions` |
| World Smart 동기화 | `POST /api/world-smart/sync` |
| World Smart 게시판 | `GET/POST /api/world-smart`, `/api/world-smart/posts/[postId]/*` |
| 작가 도슨트 대화 | `POST /api/story/docent-chat` |
| 활동 추천 3개 | `POST /api/story/docent-recommendations` |
| 토리 질문 카드 답변 저장 | 클라이언트에서 직접 `stories.tori_answers` UPDATE (별도 API 없음) |
| My World 검증 | `POST /api/story/validate` (레거시 — 토리 카드 흐름에선 사용하지 않음) |
| 초안 생성 | `POST /api/story/generate-draft` |
| 이미지 생성 | `POST /api/story/generate-image` |
| 그림 업로드 | `POST /api/story/upload-drawing` |
| 제작 시작/재생성 | `POST /api/story/produce` |
| 제작 진행 | `GET /api/story/progress` |
| 번역 | `POST /api/story/translate` |
| 공유/도장 완료 | `POST /api/story/publish` |
| 도서관 | `GET/POST /api/library`, `/api/library/read-progress` |
| 캠페인 | `/api/campaign`, `/api/campaign/[id]`, `/api/campaign/[id]/submissions`, `/api/campaign/upload` |
| 교사 | `/api/teacher/*` |
| 관리자 | `/api/admin/*` |

---

## 14. AI 설계

### 도서 원문/분석

- PDF 원문 추출 결과는 `book_pdf_texts`에 저장한다.
- 구조화 분석 결과는 `book_analyses.analysis_json`에 저장한다.
- 분석에는 줄거리, 상세 줄거리, 배경, 플롯 구조, 인물, 주요 사건, 주제, 중요 사물, 감정 키워드, 범위 밖 주제가 포함된다.

### 질문 만들기 검증

- 학생 질문을 카테고리별로 검토한다.
- 결과는 전체 통과 여부, 카테고리별 통과 여부, 질문별 칭찬/문제/힌트/예시를 포함한다.
- 통과한 질문만 World Smart로 동기화한다.

### 작가 도슨트 대화

- 모델: `gpt-5-mini` (`/api/story/docent-chat`).
- 책의 작가 1인칭 페르소나로 응답한다. 분석가/해설자 톤은 금지.
- 책 원문 + 책 분석 + 학생의 Step 1~3 활동(한 줄 감상, 질문 씨앗, 자료 메모, 질문 게시글)을 prior context로 주입한다.
- 최대 10턴까지 대화하고, 마지막 턴 이후 자동으로 활동 추천 phase로 넘어간다.
- 국가/문화 표현 가드: 나라 전체를 가난·위험·슬픔 같은 단일 이미지로 단정하지 않는다.

### 활동 추천 3개

- 모델: `gpt-5-mini` (`/api/story/docent-recommendations`).
- 12개 활동 후보 중 학생 도슨트 대화·이전 단계 메모를 가장 잘 살리는 3개를 JSON으로 반환한다.
- 각 추천은 `id`, `title`, `description`, `starter`를 가진다. `id`는 토리 카드 세트 lookup에 사용된다.
- 결과는 `stories.docent_chat_log`, `stories.docent_recommendations`에 함께 저장된다.

### 토리 질문 카드 (AI 호출 없음)

- 학생이 활동을 고르면 활동별로 정의된 3~5장의 정적 카드 세트가 나타난다 (`src/lib/tori-questions.ts`).
- 카드 답변 단계에서는 AI를 부르지 않는다. 자동 저장만 수행 → `stories.tori_answers`.
- 카드 문구는 `${country}`, `${protagonist}` 변수 치환을 지원해 어떤 책/나라에서도 동일 세트가 작동한다.
- 힌트는 클릭 불가능한 회색 예시 텍스트로만 제공한다 (학생이 직접 답을 쓰게 유도).

### 초안 생성

- 모델: `gpt-5-mini` (`/api/story/generate-draft`).
- 입력 신호 우선순위 (충돌 시 위쪽이 이김):
  1. 학생 토리 답변 (`stories.tori_answers`) — **절대 우선**
  2. 학생이 선택한 활동 (`stories.selected_activity`)
  3. 도슨트와 학생의 대화 (`stories.docent_chat_log`)
  4. Hidden Stories에서 학생이 본 자료 (`activities.explore_challenges`)
  5. 책 원문 / 도서 분석 (`book_pdf_texts`, `book_analyses`)
- 활동별 5장면 매핑이 prompt에 박혀 있어 AI가 토리 답변을 발단·전개·위기·절정·결말 슬롯에 정확히 배치한다.
- 국가/문화 가드와 stereotype 방지 가드가 prompt에 포함된다.
- 모호한 학생 답변(예: "마지막 장면")은 책 원문/분석에서 가장 가까운 장면을 추론해 적용하도록 지시한다.
- 정확히 5장면 JSON을 생성하며 각 장면은 `draft`, `advice`를 가진다.

### 이미지 생성

- 기본 모델: `gpt-image-2`.
- `OPENAI_IMAGE_MODEL`로 교체 가능.
- 장면 이미지는 학생 장면 설명을 최우선 시각 지시로 사용한다.
- 캐릭터 레퍼런스, 표지 스타일 레퍼런스, 판형 비율을 이미지 생성에 전달한다.
- 텍스트/말풍선/로고는 장면 이미지에서 금지한다.

### 번역

- 완성본 편집 단계에서 원문과 다른 언어의 번역본을 생성한다.
- `translation_text`는 영어 레거시 저장소, `translated_texts`는 다국어 저장소다.

---

## 15. 현재 운영/개발 메모

- `Prd.md`의 기준은 로컬 폴더이며, 원격 배포나 DB 실제 상태보다 현재 소스 구조를 우선한다.
- `/book/[id]/chat`는 코드에 남아 있지만 현재 4도장/여권 완료 기준에는 넣지 않는다.
- `StampType`은 `read | hidden | questions | mystory`가 기준이다. 과거 `character` 도장 데이터는 레거시로 간주한다.
- 이미 적용된 migration은 수정하지 않고 새 번호로만 추가한다.
- Supabase migration README는 일부 최신 migration을 모두 설명하지 않을 수 있으므로 실제 스키마 판단은 `supabase/migrations`와 `src/types/database.ts`를 함께 본다.
- 가장 최근 변경 (2026-04-29):
  - 토리를 양방향 AI 채팅에서 **활동별 정적 질문 카드**로 전환했다. `src/app/api/story/guide-chat/route.ts`는 삭제됨.
  - 신규 컴포넌트 `src/components/story/ToriQuestionCards.tsx`, 신규 데이터 `src/lib/tori-questions.ts` (12 활동 + `_custom` 폴백).
  - 신규 컬럼 `stories.tori_answers` (migration `034_story_tori_answers.sql`).
  - `DocentActivityRecommendation`에 `id` 필드 추가, normalizer가 보존하도록 갱신 (`docent-recommendations`).
  - `generate-draft` prompt를 신호 위계 명시 + 활동별 5장면 매핑 + Hidden Stories 컨텍스트 + stereotype 가드 + 국가 한글 표시명으로 재작성.

---

*World Stories / World Docent PRD — local code aligned, 2026.04.29*
