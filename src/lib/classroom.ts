interface ClassLookupProfile {
  id?: string;
  teacher_id?: string | null;
  school?: string | null;
  grade?: number | null;
  class?: string | null;
}

interface ClassroomRecord {
  id: string;
  teacher_id: string;
  class_name: string;
  school: string;
  grade: number;
  mystory_required_turns?: number;
}

interface ClassroomSelectResult {
  data: ClassroomRecord[] | null;
  error?: { message?: string; code?: string } | null;
}

interface ClassroomInsertResult {
  data: ClassroomRecord | null;
  error: { message?: string; code?: string } | null;
}

interface ClassroomSelectBuilder {
  eq: (column: string, value: string) => ClassroomSelectBuilder;
  limit: (count: number) => Promise<ClassroomSelectResult>;
}

interface ClassroomInsertBuilder {
  select: (columns: string) => {
    single: () => Promise<ClassroomInsertResult>;
  };
}

interface SupabaseLike {
  from: (table: string) => unknown;
}

function getClassesTable(supabase: SupabaseLike) {
  return supabase.from('classes') as {
    select: (columns: string) => ClassroomSelectBuilder;
    insert: (payload: Record<string, unknown>) => ClassroomInsertBuilder;
  };
}

function normalizeClassName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function findClassRecord(
  supabase: SupabaseLike,
  teacherId: string,
  className?: string | null
) {
  const baseQuery = getClassesTable(supabase).select('id, teacher_id, class_name, school, grade');

  if (className) {
    const { data } = await baseQuery.eq('teacher_id', teacherId).eq('class_name', className).limit(1);
    return data?.[0] ?? null;
  }

  const { data } = await baseQuery.eq('teacher_id', teacherId).limit(1);
  return data?.[0] ?? null;
}

export async function ensureTeacherClassRecord(
  supabase: SupabaseLike,
  profile: Required<Pick<ClassLookupProfile, 'id'>> & ClassLookupProfile
) {
  const className = normalizeClassName(profile.class) ?? '기본반';
  const existing = await findClassRecord(supabase, profile.id, className);

  if (existing) {
    return existing;
  }

  const school = profile.school?.trim() || '미정';
  const grade = profile.grade && profile.grade > 0 ? profile.grade : 1;
  const classesTable = getClassesTable(supabase);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await classesTable
      .insert({
        teacher_id: profile.id,
        class_code: generateClassCode(),
        school,
        grade,
        class_name: className,
        mystory_required_turns: 5,
      })
      .select('id, teacher_id, class_name, school, grade, mystory_required_turns')
      .single();

    if (data) {
      return data;
    }

    if (!error?.message?.includes('class_code')) {
      throw new Error(error?.message || '반 정보를 생성하지 못했습니다.');
    }
  }

  throw new Error('반 코드 생성이 반복해서 충돌했습니다.');
}

export async function getStudentClassSetting(
  supabase: SupabaseLike,
  profile: ClassLookupProfile | null | undefined
) {
  const teacherId = profile?.teacher_id ?? null;

  if (!teacherId) {
    return null;
  }

  const className = normalizeClassName(profile?.class);
  const classesTable = getClassesTable(supabase);

  const exactQuery = classesTable.select(
    'id, teacher_id, class_name, school, grade, mystory_required_turns'
  );

  if (className) {
    const { data } = await exactQuery.eq('teacher_id', teacherId).eq('class_name', className).limit(1);
    if (data?.[0]) {
      return data[0];
    }
  }

  const fallbackQuery = classesTable.select(
    'id, teacher_id, class_name, school, grade, mystory_required_turns'
  );
  const { data } = await fallbackQuery.eq('teacher_id', teacherId).limit(1);
  return data?.[0] ?? null;
}

export async function resolveUserClassId(
  supabase: SupabaseLike,
  profile: ClassLookupProfile | null | undefined
) {
  const teacherId = profile?.teacher_id ?? null;

  if (!teacherId) {
    return null;
  }

  const className = normalizeClassName(profile?.class);
  const exactMatch = await findClassRecord(supabase, teacherId, className);

  if (exactMatch) {
    return exactMatch.id;
  }

  const fallback = await findClassRecord(supabase, teacherId);
  return fallback?.id ?? null;
}
