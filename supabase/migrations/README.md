# Supabase Migrations

현재 마이그레이션은 생성 순서대로 적용해야 합니다.

## 적용 순서

1. `001_initial_schema.sql`
   - 핵심 enum, 테이블, 인덱스, 기본 RLS 정책을 생성합니다.
   - `users`, `classes`, `books`, `hidden_content`, `activities`, `chat_logs`, `stories`, `library`, `approval_requests`와 스토리 상호작용 테이블을 포함합니다.

2. `002_class_visibility_policies.sql`
   - `hidden_content`, `stories`의 class scope 조회 정책을 보강합니다.

3. `003_story_read_progress_comment_policy.sql`
   - `story_read_progress` 테이블을 추가하고, 완독 후 댓글 작성 정책으로 교체합니다.

4. `004_book_visibility_policies.sql`
   - `books`의 global/class scope 조회 정책을 보강합니다.

5. `005_fix_recursive_rls_policies.sql`
   - 앞선 RLS 정책에서 발생할 수 있는 재귀 참조 문제를 `SECURITY DEFINER` 함수 기반으로 정리합니다.
   - `002`, `004`에서 추가한 정책을 최종 형태로 다시 정의하므로 반드시 마지막에 적용되어야 합니다.
   - 원격 DB에 과거 수동 정책이 남아 있던 경우, 이 파일을 다시 실행해 legacy policy를 정리해야 합니다.

## 원격 DB 상태 점검

- 애플리케이션 레벨 점검은 `npx tsx scripts/check-books.ts` 또는 `npx tsx scripts/check-db-health.ts`로 확인합니다.
- 이번 점검 기준 원격 `books` 테이블에는 탄자니아 책 1권이 정상 존재했고, anon/service role 조회 모두 통과했습니다.
- 다만 일부 환경은 `supabase_migrations.schema_migrations` 히스토리 테이블이 비어 있거나 생성되지 않은 상태일 수 있습니다.

## Migration History 정리

- 스키마가 이미 있는 원격 DB에 `supabase db push`를 바로 실행하면 `001`부터 다시 적용하려고 시도할 수 있습니다.
- 먼저 실제 스키마와 RLS가 정상인지 확인한 뒤, 원격 migration history를 별도로 맞춰야 합니다.
- 이 저장소에서는 히스토리 정리가 끝나기 전까지 기존 migration 파일을 수정하지 않고 `005` 이후 새 번호만 추가합니다.
- 원격 히스토리 복구 전에는 SQL 파일을 직접 실행하거나, Supabase CLI의 `migration repair`로 적용 상태를 기록하는 방식이 안전합니다.

## 운영 원칙

- 이미 적용된 파일은 수정하지 않고 새 번호의 마이그레이션을 추가합니다.
- RLS 변경이 필요하면 `005`의 helper 함수와 충돌하지 않는지 먼저 확인합니다.
- 이번 표지/PDF 렌더 수정은 애플리케이션 코드 변경이라 신규 SQL 마이그레이션이 필요하지 않습니다.
