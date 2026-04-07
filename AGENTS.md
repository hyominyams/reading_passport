# World Docent - 작업 분할 가이드

## 핵심 맥락

- **프로젝트**: 제3세계 그림책 기반 글로벌 독서교육 웹앱
- **스택**: Next.js (App Router) + Supabase + Vercel + Tailwind + Framer Motion
- **AI**: GPT-5-mini (텍스트), Nanobanana2 (이미지, cref 지원)
- **역할**: 관리자 / 교사(이메일 가입) / 학생(6자리 코드 로그인)
- **핵심 흐름**: 로그인 → 국가/책 선택 → 언어 선택(한/영) → 3분할 활동(Read, Hidden, Chat) → My Story 창작 → 서재 등록
- **도장 시스템**: 책 1권당 4개 (Read/Hidden/Chat/MyStory), 4개 완성 시 여권 페이지 완성

## DB 핵심 테이블

users, classes, books, hidden_content, activities, chat_logs, stories, library, approval_requests

## 라우트 구조

```
/login
/map                          — 국가/책 선택
/book/[id]                    — 책 표지 & 소개
/book/[id]/activity           — 3분할 카드 선택
/book/[id]/read               — Story Read (PDF 뷰어)
/book/[id]/explore            — Hidden Stories (카드 피드)
/book/[id]/chat               — Talk with Character (AI 챗봇)
/book/[id]/mystory            — 유형 선택 + 게이지 채팅
/book/[id]/mystory/write      — 좌우 에디터
/book/[id]/mystory/characters — 캐릭터 디자인
/book/[id]/mystory/scenes     — 장면별 이미지 생성
/book/[id]/mystory/finish     — 완성 & 서재 등록
/library                      — 서재
/teacher                      — 교사 대시보드
/admin                        — 관리자 페이지
```

---

## 병렬 작업 분할 (5개 스트림)

### Phase 0: Foundation (선행 필수)
> 모든 스트림의 전제조건. 이것이 완료된 후 아래 4개가 병렬 가능.

- Next.js 프로젝트 초기 세팅 (Tailwind, Framer Motion, 폴더 구조)
- Supabase 연결 + 전체 DB 테이블 생성 + RLS 정책
- 인증 시스템: 교사 이메일 로그인 / 학생 6자리 코드 로그인
- 공통 레이아웃, 미들웨어, 역할 기반 라우트 가드
- `/login` 페이지

### Stream A: 책 열람 흐름
> 라우트: `/map`, `/book/[id]`, `/book/[id]/activity`, `/book/[id]/read`

- 국가/책 선택 UI (지도 or 카드 그리드)
- 언어 선택 모달
- 책 표지 & 소개 페이지
- 3분할 카드 선택 (호버 인터랙션, 도장 표시)
- Story Read: PDF 뷰어 + 감정 스티커 + 한줄 감상 → 도장 1
- activities 테이블 연동

### Stream B: Hidden Stories + Talk with Character
> 라우트: `/book/[id]/explore`, `/book/[id]/chat`

- Hidden Stories: 콘텐츠 카드 피드 (YouTube/PDF/이미지/링크) → 도장 2
- Talk with Character: 등장인물 선택 → AI 1인칭 챗봇 + 사이드바 → 도장 3
- 책 등록 시 등장인물 자동 스캔 (GPT-5-mini)
- 부적절 내용 플래그 스크리닝
- chat_logs, hidden_content 테이블 연동

### Stream C: My Story 창작 파이프라인
> 라우트: `/book/[id]/mystory`, `/mystory/write`, `/mystory/characters`, `/mystory/scenes`, `/mystory/finish`, `/library`

- 이야기 유형 선택 (5가지)
- 게이지 채팅 (클라이언트 사이드 게이지 계산 + AI 대화)
- 소형모델 최종 검증
- AI 초안 생성 ([PAGE_BREAK] 분할)
- 좌우 에디터 (AI 초안 vs 학생 작성)
- 캐릭터 디자인 (외모 입력 → enhancer → Nanobanana2)
- 장면별 이미지 생성 (cref 자동 감지)
- 완성: 번역 + PDF + 서재 등록 + 도장 4
- stories, library 테이블 연동

### Stream D: 관리 시스템
> 라우트: `/teacher`, `/admin`

- 교사 대시보드: 반 전체 현황 → 학생 개인 → 대화 상세 (3단계 드릴다운)
- 교사: Hidden Stories CRUD + 배포 범위 + 콘텐츠 승인 요청
- 교사: 학생 계정 일괄 발급 + 갤러리
- 관리자: 교사 관리 + 승인 검토 + 전역 콘텐츠/서재 관리
- approval_requests 테이블 연동

---

## 스트림 간 의존성

```
Phase 0 (Foundation)
    ├── Stream A (책 열람) ─────────────────────┐
    ├── Stream B (Hidden + Chat) ───────────────┤ 공유: books 테이블, activities 테이블
    ├── Stream C (My Story) ────────────────────┤ C는 B의 Hidden Stories 요약 참조 (약한 의존)
    └── Stream D (관리) ────────────────────────┘ D는 A/B/C의 데이터 읽기만 함
```

- A, B, C, D는 서로 다른 라우트를 담당하므로 파일 충돌 없음
- 공유 자원(DB 테이블, 타입 정의)은 Phase 0에서 미리 정의
- Stream C의 에디터에서 Hidden Stories 요약을 참조하지만, 접었다 펼치기 패널이므로 나중에 연결 가능
- Stream D는 다른 스트림의 데이터를 읽기만 하므로 독립적으로 UI/API 구축 가능
