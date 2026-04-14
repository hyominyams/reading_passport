'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Activity, Book, ChatLog, Class, User } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StudentTable from '@/components/teacher/StudentTable';
import StudentDetail from '@/components/teacher/StudentDetail';
import ChatHistoryView from '@/components/teacher/ChatHistoryView';

interface TeacherStats {
  students: number;
  classes: number;
  books: number;
  hiddenContent: number;
  pendingApprovals: number;
  completedStories: number;
  flaggedChats: number;
}

interface TeacherSummary extends User {
  stats: TeacherStats;
  canDelete: boolean;
}

interface TeacherDetailData {
  teacher: User;
  stats: TeacherStats;
  dependencies: {
    students: number;
    books: number;
    hiddenContent: number;
  };
  canDelete: boolean;
  classes: Class[];
  recentBooks: Array<{
    id: string;
    title: string;
    country_id: string;
    approved: boolean;
    created_at: string;
    scope: 'global' | 'class';
  }>;
  recentHiddenContent: Array<{
    id: string;
    title: string;
    type: 'video' | 'pdf' | 'image' | 'link';
    book_id: string;
    approved: boolean;
    scope: 'global' | 'class';
  }>;
}

interface StudentWithActivity extends User {
  allActivities: (Activity & { book?: Book })[];
  hasFlaggedChat?: boolean;
}

type ViewMode = 'list' | 'teacher' | 'student' | 'chat';

interface TeacherFormState {
  email: string;
  password: string;
  nickname: string;
  school: string;
  grade: string;
  className: string;
}

const emptyForm: TeacherFormState = {
  email: '',
  password: '',
  nickname: '',
  school: '',
  grade: '',
  className: '',
};

function TeacherFormModal({
  mode,
  form,
  saving,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  form: TeacherFormState;
  saving: boolean;
  error: string;
  onClose: () => void;
  onChange: (key: keyof TeacherFormState, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {mode === 'create' ? '교사 계정 생성' : '교사 정보 수정'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {mode === 'create'
                ? '이메일과 임시 비밀번호로 바로 로그인 가능한 teacher 계정을 생성합니다.'
                : '학교, 대표 반, 닉네임 등 운영 정보를 수정합니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition-colors hover:bg-muted-light hover:text-foreground"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-foreground">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange('email', event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="teacher@school.kr"
              />
            </div>

            {mode === 'create' && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-foreground">임시 비밀번호</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(event) => onChange('password', event.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="최소 8자"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">닉네임</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(event) => onChange('nickname', event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="비워두면 자동 생성"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">학교</label>
              <input
                type="text"
                value={form.school}
                onChange={(event) => onChange('school', event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="학교명"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">학년</label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.grade}
                onChange={(event) => onChange('grade', event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="예: 5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">대표 반</label>
              <input
                type="text"
                value={form.className}
                onChange={(event) => onChange('className', event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="예: 2반"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted-light"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? '저장 중...' : mode === 'create' ? '교사 생성' : '정보 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordResetModal({
  password,
  saving,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  password: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-6 shadow-xl">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-foreground">임시 비밀번호 재설정</h3>
          <p className="mt-1 text-sm text-muted">
            관리자만 사용할 수 있는 일회성 재설정입니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">새 임시 비밀번호</label>
            <input
              type="text"
              value={password}
              onChange={(event) => onChange(event.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="최소 8자"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted-light"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? '변경 중...' : '비밀번호 재설정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeacherList() {
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDetailData | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<StudentWithActivity[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithActivity | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatLog | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [form, setForm] = useState<TeacherFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const fetchTeachers = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/teachers');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '교사 목록을 불러오지 못했습니다');
      }

      setTeachers((data.teachers ?? []) as TeacherSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherDetail = async (teacherId: string) => {
    setDetailLoading(true);
    setError('');

    try {
      const [detailRes, studentsRes] = await Promise.all([
        fetch(`/api/admin/teachers/${teacherId}`),
        fetch(`/api/admin/teachers/${teacherId}/students`),
      ]);

      const detailData = await detailRes.json();
      const studentsData = await studentsRes.json();

      if (!detailRes.ok) {
        throw new Error(detailData.error || '교사 상세 정보를 불러오지 못했습니다');
      }

      if (!studentsRes.ok) {
        throw new Error(studentsData.error || '학생 목록을 불러오지 못했습니다');
      }

      setSelectedTeacher(detailData as TeacherDetailData);
      setTeacherStudents(
        ((studentsData.students ?? []) as Array<User & {
          currentActivity?: Activity & { book?: Book };
          hasFlaggedChat?: boolean;
        }>).map((student) => ({
          ...student,
          allActivities: student.currentActivity ? [student.currentActivity] : [],
        }))
      );
      setSelectedStudent(null);
      setSelectedChat(null);
      setViewMode('teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void fetchTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return teachers;
    }

    return teachers.filter((teacher) => {
      const haystack = [
        teacher.nickname,
        teacher.email,
        teacher.school,
        teacher.class,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [query, teachers]);

  const openCreateForm = () => {
    setFormMode('create');
    setEditingTeacherId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (teacher: TeacherSummary | TeacherDetailData['teacher']) => {
    setFormMode('edit');
    setEditingTeacherId(teacher.id);
    setForm({
      email: teacher.email ?? '',
      password: '',
      nickname: teacher.nickname ?? '',
      school: teacher.school ?? '',
      grade: teacher.grade ? String(teacher.grade) : '',
      className: teacher.class ?? '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleTeacherSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    const payload = {
      email: form.email.trim(),
      password: form.password.trim(),
      nickname: form.nickname.trim(),
      school: form.school.trim(),
      grade: form.grade ? Number(form.grade) : null,
      className: form.className.trim(),
    };

    try {
      const res = await fetch(
        formMode === 'create' ? '/api/admin/teachers' : `/api/admin/teachers/${editingTeacherId}`,
        {
          method: formMode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '교사 저장에 실패했습니다');
      }

      setShowForm(false);
      await fetchTeachers();

      const targetId = formMode === 'create' ? data.teacher?.id : editingTeacherId;
      if (targetId) {
        await fetchTeacherDetail(targetId);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const confirmed = window.confirm('이 교사를 삭제하시겠습니까? 연결된 데이터가 있으면 삭제되지 않습니다.');
    if (!confirmed) {
      return;
    }

    setError('');

    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.dependencies) {
          throw new Error(
            `삭제할 수 없습니다. 학생 ${data.dependencies.students}명, 도서 ${data.dependencies.books}건, Hidden Stories ${data.dependencies.hiddenContent}건이 연결되어 있습니다.`
          );
        }
        throw new Error(data.error || '교사 삭제에 실패했습니다');
      }

      if (selectedTeacher?.teacher.id === teacherId) {
        setSelectedTeacher(null);
        setTeacherStudents([]);
        setViewMode('list');
      }

      await fetchTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTeacher) {
      return;
    }

    setPasswordSaving(true);
    setPasswordError('');

    try {
      const res = await fetch(`/api/admin/teachers/${selectedTeacher.teacher.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordDraft.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 재설정에 실패했습니다');
      }

      setShowPasswordReset(false);
      setPasswordDraft('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (viewMode === 'chat' && selectedChat && selectedStudent) {
    return (
      <ChatHistoryView
        chatLog={selectedChat}
        studentName={selectedStudent.nickname ?? '학생'}
        onBack={() => setViewMode('student')}
      />
    );
  }

  if (viewMode === 'student' && selectedStudent) {
    return (
      <StudentDetail
        student={selectedStudent}
        onBack={() => setViewMode('teacher')}
        onViewChat={(chatLog) => {
          setSelectedChat(chatLog);
          setViewMode('chat');
        }}
      />
    );
  }

  if (viewMode === 'teacher' && selectedTeacher) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          ← 교사 목록으로
        </button>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold text-foreground">
                  {selectedTeacher.teacher.nickname || selectedTeacher.teacher.email || '교사'}
                </h3>
                <span className="rounded-full bg-muted-light px-3 py-1 text-xs font-medium text-foreground">
                  교사 상세
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {selectedTeacher.teacher.email || '이메일 없음'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {selectedTeacher.teacher.school || '학교 미등록'}
                {selectedTeacher.teacher.grade ? ` · ${selectedTeacher.teacher.grade}학년` : ''}
                {selectedTeacher.teacher.class ? ` · ${selectedTeacher.teacher.class}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEditForm(selectedTeacher.teacher)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted-light"
              >
                정보 수정
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordDraft('');
                  setPasswordError('');
                  setShowPasswordReset(true);
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted-light"
              >
                비밀번호 재설정
              </button>
              <button
                type="button"
                disabled={!selectedTeacher.canDelete}
                onClick={() => void handleDeleteTeacher(selectedTeacher.teacher.id)}
                className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                교사 삭제
              </button>
            </div>
          </div>

          {!selectedTeacher.canDelete && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              연결된 학생 {selectedTeacher.dependencies.students}명, 도서 {selectedTeacher.dependencies.books}건,
              Hidden Stories {selectedTeacher.dependencies.hiddenContent}건이 있어 삭제할 수 없습니다.
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['학생', selectedTeacher.stats.students],
            ['반', selectedTeacher.stats.classes],
            ['도서', selectedTeacher.stats.books],
            ['Hidden Stories', selectedTeacher.stats.hiddenContent],
            ['완성 이야기', selectedTeacher.stats.completedStories],
            ['대기 승인', selectedTeacher.stats.pendingApprovals],
            ['플래그 대화', selectedTeacher.stats.flaggedChats],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-border bg-muted-light/50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
            </article>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-foreground">반 설정</h4>
              <p className="mt-1 text-sm text-muted">대표 반과 운영 중인 학급의 설정값입니다.</p>
            </div>

            <div className="space-y-3">
              {selectedTeacher.classes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                  아직 생성된 반이 없습니다.
                </div>
              ) : (
                selectedTeacher.classes.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {item.grade}학년 {item.class_name}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          반 코드 {item.class_code} · 질문 {item.questions_required_count}개 · My World {item.mystory_required_turns}턴
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-foreground">최근 운영 콘텐츠</h4>
              <p className="mt-1 text-sm text-muted">교사가 생성한 책과 Hidden Stories를 빠르게 점검합니다.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">도서</p>
                {selectedTeacher.recentBooks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                    생성한 도서가 없습니다.
                  </div>
                ) : (
                  selectedTeacher.recentBooks.map((book) => (
                    <div key={book.id} className="rounded-2xl border border-border px-4 py-4">
                      <p className="font-medium text-foreground">{book.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {book.country_id} · {book.scope === 'global' ? '전체 공개' : '반 전용'} · {book.approved ? '승인됨' : '대기'}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Hidden Stories</p>
                {selectedTeacher.recentHiddenContent.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                    생성한 Hidden Story가 없습니다.
                  </div>
                ) : (
                  selectedTeacher.recentHiddenContent.map((content) => (
                    <div key={content.id} className="rounded-2xl border border-border px-4 py-4">
                      <p className="font-medium text-foreground">{content.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {content.type.toUpperCase()} · {content.scope === 'global' ? '전체 공개' : '반 전용'} · {content.approved ? '승인됨' : '대기'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-foreground">담당 학생</h4>
              <p className="mt-1 text-sm text-muted">학생 활동 상황과 플래그 대화를 드릴다운으로 확인합니다.</p>
            </div>
            <span className="text-sm text-muted">총 {teacherStudents.length}명</span>
          </div>

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner message="학생 현황을 불러오는 중..." />
            </div>
          ) : (
            <StudentTable
              students={teacherStudents}
              onSelectStudent={(student) => {
                setSelectedStudent(student);
                setViewMode('student');
              }}
            />
          )}
        </section>

        {showForm && (
          <TeacherFormModal
            mode={formMode}
            form={form}
            saving={saving}
            error={formError}
            onClose={() => setShowForm(false)}
            onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
            onSubmit={handleTeacherSubmit}
          />
        )}

        {showPasswordReset && (
          <PasswordResetModal
            password={passwordDraft}
            saving={passwordSaving}
            error={passwordError}
            onClose={() => setShowPasswordReset(false)}
            onChange={setPasswordDraft}
            onSubmit={handleResetPassword}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">교사 계정 관리</h3>
            <p className="mt-1 text-sm text-muted">
              교사 생성, 정보 수정, 안전 삭제, 학생 운영 현황 drilldown을 한 곳에서 관리합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 이메일, 학교 검색"
              className="min-w-[240px] rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
            >
              + 교사 생성
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="교사 목록을 불러오는 중..." />
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
            표시할 교사가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted-light/70">
                  <th className="px-4 py-3 text-left font-medium text-muted">교사</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">학교</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">학생</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">반</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">도서</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">승인 대기</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">플래그</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">가입일</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {teacher.nickname || teacher.email || '교사'}
                        </p>
                        <p className="mt-1 text-xs text-muted">{teacher.email || '이메일 없음'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {teacher.school || '-'}
                      {teacher.grade ? ` · ${teacher.grade}학년` : ''}
                      {teacher.class ? ` · ${teacher.class}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">{teacher.stats.students}</td>
                    <td className="px-4 py-3 text-center text-foreground">{teacher.stats.classes}</td>
                    <td className="px-4 py-3 text-center text-foreground">{teacher.stats.books}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        teacher.stats.pendingApprovals > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {teacher.stats.pendingApprovals}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        teacher.stats.flaggedChats > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {teacher.stats.flaggedChats}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted">
                      {new Date(teacher.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void fetchTeacherDetail(teacher.id)}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted-light"
                        >
                          상세
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(teacher)}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted-light"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={!teacher.canDelete}
                          onClick={() => void handleDeleteTeacher(teacher.id)}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <TeacherFormModal
          mode={formMode}
          form={form}
          saving={saving}
          error={formError}
          onClose={() => setShowForm(false)}
          onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
          onSubmit={handleTeacherSubmit}
        />
      )}
    </div>
  );
}
