# Admin Page Implementation Plan

## Goal

관리자 페이지를 단순 조회 화면이 아니라 운영 허브로 재구성한다.

- 교사 관리
- 승인 처리
- 글로벌 도서/Hidden Stories/부가 데이터 관리
- 학생 작품 라이브러리 moderation
- 관리자 전용 권한 경계와 감사 로그

UI/UX는 기존 학생/교사 페이지의 구조 문법을 유지하되, 관리자 전용 색상 스코프를 분리해서 운영 화면처럼 보이게 만든다.

---

## Verified Current State

### Existing admin surface

- `/admin` 라우트와 기본 섹션 UI는 이미 존재한다.
- 현재 섹션은 `교사 관리`, `콘텐츠 승인`, `도서/콘텐츠 관리`, `도서관 관리` 4개다.
- `src/components/admin/*` 컴포넌트가 일부 존재하지만 운영용으로는 범위가 좁다.

### Existing admin APIs

- 현재 `/api/admin/*`는 `books`, `approvals`만 존재한다.
- `src/lib/queries/admin.ts`에는 `hidden_content`, `library`, `story visibility`용 helper가 있지만 API/UI에 연결되어 있지 않다.

### Teacher/admin boundary

- 현재 admin은 `/teacher`에 접근 가능하다.
- 하지만 teacher API는 대부분 `user.id`를 기준으로 자기 반만 읽고 쓰므로, admin이 teacher 화면을 통해 작업하면 관리자 자신을 teacher처럼 취급하는 잘못된 흐름이 발생한다.

### Logic issues already confirmed

- `stories.visibility`는 admin UI에서 브라우저에서 직접 수정하고 있는데, 현재 RLS 상 admin은 `stories`를 직접 `UPDATE`할 수 없다.
- 승인 처리 로직은 비원자적이며 `reviewerId`를 저장하지 않는다.
- 승인 화면은 실제 검토에 필요한 콘텐츠 상세/미리보기/반려 사유를 보여주지 않는다.
- `teacher` 관리 탭은 사실상 read-only 목록이다.
- `book/content` 관리 탭은 실제로 `books`만 관리한다.
- library 지표는 `library.likes`와 `story_likes` 집계가 혼재되어 있다.
- `chat_type`, `stamp_type` enum과 앱 코드가 어긋나 있어 Expanding World 저장/도장 적립이 불안정하다.

---

## Decisions

### 1. Admin and teacher surfaces are separated

다음 방향으로 고정한다.

- `/teacher`는 실제 teacher 전용 화면으로 본다.
- admin은 `/admin` 안에서 teacher 목록, teacher 상세, teacher의 학생/반/활동/채팅을 본다.
- admin이 teacher API를 재사용해서 “teacher처럼 동작”하는 구조는 폐기한다.

이 결정으로 관리자 로직이 단순해지고, admin이 잘못된 `teacher_id`/`class` 문맥으로 쓰기 작업을 수행하는 문제를 막을 수 있다.

### 2. Admin writes go through admin APIs only

- admin UI에서 직접 Supabase client로 쓰기 작업을 하지 않는다.
- 모든 관리자 쓰기 작업은 `/api/admin/*`를 통해 service role 또는 server client에서 수행한다.
- 읽기 역시 가능한 한 admin API를 통일적으로 사용한다.

### 3. Approval handling must be auditable

- 승인/반려는 reviewer 정보와 note를 남긴다.
- 승인 상태와 대상 콘텐츠 공개 상태는 원자적으로 같이 바뀌어야 한다.
- 승인 화면에서 최소한 제목, 요청자, 대상 콘텐츠 종류, preview, scope를 본 뒤 처리할 수 있어야 한다.

### 4. Teacher deletion is guarded

- 교사를 무조건 하드 삭제하지 않는다.
- 의존 데이터가 남아 있으면 삭제를 막고 의존성 수를 보여준다.
- 우선 차단 대상으로 본다.
  - `users.teacher_id`로 연결된 학생
  - `books.created_by`로 연결된 도서
  - `hidden_content.created_by`로 연결된 콘텐츠
- `classes`는 `teacher_id` 기준 cascade지만, 학생/도서/콘텐츠가 남아 있으면 결과적으로 teacher 삭제가 안전하지 않다.
- 1차 구현에서는 `생성`, `수정`, `상세 조회`, `의존성 확인`, `안전 삭제(의존성 없는 경우만)`까지 포함한다.
- 재배정/일괄 이관은 후속 단계로 둔다.

### 5. Admin content scope

관리자 데이터 관리 범위는 아래까지 포함한다.

- books
- hidden_content
- approval_requests
- library/stories moderation
- country_facts

`country_facts`는 현재 admin-only 테이블이므로 `/admin` 범위에 포함한다.

---

## Required Pre-Work Before Admin UI Build

### A. Schema alignment

새 마이그레이션에서 아래를 정리한다.

- `chat_type` enum에 `questions` 추가
- `stamp_type` enum에 `questions` 추가
- 기존 legacy `character` stamp가 있다면 `questions`로 정규화하거나 호환 처리
- `approval_requests`에 reviewer/audit 컬럼 추가
  - `reviewer_id`
  - `review_note` 또는 `rejection_reason`
  - 가능하면 `content_title`, `content_scope` 같은 snapshot 컬럼도 추가

### B. Approval atomicity

승인 처리 로직을 아래 중 하나로 바꾼다.

- Postgres function/RPC로 `approval_requests`와 대상 콘텐츠를 한 번에 갱신
- 또는 service role에서 실패 시 rollback 가능한 단일 원자적 경로 구성

실제 구현은 DB 함수 기반을 우선한다.

### C. Auth helper normalization

중복된 권한 확인 코드를 정리한다.

- `requireAdmin`
- `requireTeacher`
- `requireTeacherOrAdmin`

권한 체크/유저 프로필 로딩을 각 route에서 반복하지 않도록 공통 helper를 둔다.

### D. Admin route boundary

다음 수정이 필요하다.

- middleware에서 `/teacher`는 teacher만 허용
- `useAuth().isTeacher`는 teacher만 의미하도록 정리
- admin 전용 drilldown은 `/admin`에서 제공

---

## Admin Information Architecture

관리자 페이지는 teacher 페이지와 비슷한 구조로 재편한다.

- 상단 공통 Header 유지
- admin 전용 info bar 추가
- hero + summary cards
- tab navigation
- 각 탭은 panel/card 패턴 유지

### Recommended tabs

1. `Overview`
2. `Teachers`
3. `Approvals`
4. `Content`
5. `Library`
6. `Facts`

### Overview cards

- 총 교사 수
- 총 학생 수
- 대기 중 승인 수
- 글로벌 도서 수
- Hidden Stories 수
- 도서관 등록 작품 수
- 플래그된 대화 수

---

## Implementation Scope by Area

### 1. Overview

목표:

- 운영 현황을 한 화면에 요약
- 승인 대기와 위험 신호를 바로 확인

필요 기능:

- 요약 카드
- 최근 승인 요청 리스트
- 최근 생성 교사/도서/작품 리스트
- 플래그된 채팅 카운트 또는 최근 flagged entries 요약

필요 API:

- `/api/admin/overview`

### 2. Teachers

목표:

- 교사 계정 생성/수정/조회/안전 삭제
- 교사별 운영 현황 drilldown

필요 기능:

- 교사 목록 검색/정렬/필터
- 교사 생성
  - 이메일
  - 임시 비밀번호
  - 닉네임
  - 학교
  - 학년
  - 대표 반 이름
- 교사 수정
- 비밀번호 재설정
  - admin이 임시 비밀번호를 다시 발급할 수 있어야 함
- 교사 상세 패널
  - 기본 정보
  - class 목록
  - 학생 수
  - 진행 중 활동 수
  - 완료 작품 수
  - 승인 요청 수
  - 플래그된 채팅 수
- teacher 상세 안에서 학생 목록 확인
- 학생 상세/대화 상세 drilldown
- 의존성 없는 교사 안전 삭제

필요 API:

- `/api/admin/teachers` `GET/POST`
- `/api/admin/teachers/[id]` `GET/PUT/DELETE`
- `/api/admin/teachers/[id]/password`
- `/api/admin/teachers/[id]/students`
- `/api/admin/teachers/[id]/classes`
- `/api/admin/teachers/[id]/activity`
- `/api/admin/teachers/[id]/library`

참고 UI:

- teacher page의 `StudentTable`, `StudentDetail`, `ChatHistoryView` 패턴 재사용

### 3. Approvals

목표:

- 글로벌 공개 요청을 안전하게 검토/처리
- 처리 이력과 reviewer 정보를 남김

필요 기능:

- pending/history 탭
- 책/Hidden Story 요청 필터
- 요청자 정보
- 대상 콘텐츠 preview
  - 제목
  - 국가
  - scope
  - 책 표지 또는 Hidden Story URL
- 승인/반려 note 입력
- 처리 후 즉시 상태 반영

필요 API:

- `/api/admin/approvals` `GET/POST`
- 필요 시 `/api/admin/approvals/history`

필요 로직:

- 승인 처리 원자화
- reviewer audit 기록

### 4. Content

목표:

- 글로벌 운영 콘텐츠를 한 곳에서 관리

구성:

- `Books`
- `Hidden Stories`

#### Books

필요 기능:

- 기존 CRUD 유지
- 국가 선택을 free text가 아니라 `countries` 데이터 기반으로 변경
- 검색/필터/정렬
- approval 상태, 분석 상태, 언어 상태 표시
- 연결된 Hidden Stories 개수/바로가기

#### Hidden Stories

필요 기능:

- 글로벌 Hidden Story 목록
- 책/국가/타입/승인 상태 필터
- 생성/수정/삭제
- order 변경
- teacher 생성 콘텐츠와 admin 생성 콘텐츠 구분
- 책 상세와 연결

필요 API:

- `/api/admin/books`
- `/api/admin/hidden-content`

기존 helper 재사용 후보:

- `src/lib/queries/admin.ts`의 `getAllHiddenContent`, `createHiddenContent`, `updateHiddenContent`, `deleteHiddenContent`

### 5. Library

목표:

- 학생 작품 노출과 공개 범위를 관리자 관점에서 moderation

필요 기능:

- 작품 검색
- 교사/학생/국가/책/visibility/in_library 필터
- 정렬
  - 최신순
  - 좋아요순
  - 조회순
- 작품 상세 preview
- library 등록/제외
- visibility 변경
  - `public`
  - `class`
  - `private`
- 작품 삭제 또는 library에서만 제거

필요 API:

- `/api/admin/library` `GET/PUT/DELETE`
- 필요 시 `/api/admin/stories/[id]` moderation endpoint

필요 로직:

- browser-side direct write 제거
- `likes` 기준을 `story_likes` 집계와 맞춤

### 6. Facts

목표:

- `country_facts`를 관리자에서 운영 가능하게 함

필요 기능:

- 국가별 fact 목록
- 생성/수정/삭제
- 순서 변경
- 한/영 문구 편집

필요 API:

- `/api/admin/facts`

---

## UI / UX Direction

### Visual principle

- teacher 페이지와 비슷한 정보 밀도, 카드 구조, 탭 구조를 유지
- admin만 색상 계열을 다르게 적용

### Admin color direction

- 전역 `:root` 변경 금지
- `src/app/admin/layout.tsx` wrapper 아래에서 CSS 변수를 재정의
- 추천 톤
  - slate / cobalt / steel blue
  - teacher보다 차갑고 운영툴스러운 분위기

### Mobile

- `/admin` 전용 하단 탭바와 공통 `MobileNav`의 중복을 제거
- 모바일 탭 구조는 단일 네비 체계로 정리

---

## File-Level Plan

### Schema / DB

- `supabase/migrations/*`
  - enum 정합성
  - approval audit 컬럼
  - approval 처리 함수

### Shared auth / guards

- `src/lib/*` 또는 `src/app/api/_shared/*`
  - admin/teacher 권한 helper
- `src/middleware.ts`
- `src/hooks/useAuth.ts`

### Admin APIs

- `src/app/api/admin/overview/route.ts`
- `src/app/api/admin/teachers/route.ts`
- `src/app/api/admin/teachers/[id]/route.ts`
- `src/app/api/admin/teachers/[id]/students/route.ts`
- `src/app/api/admin/library/route.ts`
- `src/app/api/admin/hidden-content/route.ts`
- `src/app/api/admin/facts/route.ts`
- 기존 `approvals`, `books` 보강

### Admin queries

- `src/lib/queries/admin.ts`
  - teacher list/detail/stats
  - approval payload 확장
  - hidden content CRUD 연결
  - library moderation query 정리
  - facts CRUD 추가

### Admin UI

- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/components/admin/*`
  - `AdminOverview`
  - `TeacherManager`
  - `TeacherDetailPanel`
  - `ApprovalQueue`
  - `BookManager`
  - `HiddenContentManager`
  - `LibraryAdmin`
  - `FactsManager`

---

## Build Order

### Phase 1. Logic and schema fix

- enum 정합성 수정
- approval audit/atomic 처리 추가
- auth helper 정리
- admin/teacher 경계 수정

### Phase 2. Admin data layer

- admin queries 보강
- admin API 라우트 추가

### Phase 3. Admin shell and overview

- layout 색상 스코프
- info bar
- hero
- summary cards
- tabs

### Phase 4. Teachers

- 목록
- 생성
- 수정
- 상세 drilldown
- 안전 삭제

### Phase 5. Approvals

- preview
- 처리 note
- history

### Phase 6. Content

- books 개선
- hidden content manager 추가

### Phase 7. Library and facts

- library moderation
- country facts CRUD

### Phase 8. Validation

- lint
- build
- 주요 관리자 흐름 수동 검증

---

## Validation Checklist

- admin은 `/teacher`에서 teacher처럼 쓰기 작업을 하지 못한다.
- admin은 `/admin`에서 교사 생성/수정/안전 삭제가 가능하다.
- admin은 teacher별 학생/반/활동/채팅 drilldown을 본다.
- 승인 요청은 콘텐츠 preview와 note를 포함해 처리된다.
- 승인 처리 후 request 상태와 대상 콘텐츠 상태가 일치한다.
- admin은 books와 hidden content를 모두 CRUD할 수 있다.
- admin library moderation은 server API를 통해 동작한다.
- visibility `public/class/private`가 모두 동작한다.
- likes/조회수 정렬 기준이 공개 library와 일관된다.
- `country_facts`를 관리자에서 관리할 수 있다.
- admin UI는 teacher와 유사한 구조지만 다른 색상 스코프를 가진다.
- 모바일에서 admin 하단 네비가 중복되지 않는다.

---

## Open Risk Items To Re-Check Before Coding

- teacher 생성 시 임시 비밀번호 정책과 표시 방식을 어떻게 둘지
- teacher 비밀번호 재설정 UX를 어느 섹션에 둘지
- approval snapshot 컬럼을 어디까지 저장할지
- `library.likes`를 유지할지, `story_likes` 집계만 사용할지

이 항목들은 구현 중 즉흥적으로 결정하지 않고, 코드 착수 전에 다시 확인한다.
