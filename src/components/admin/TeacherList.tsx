'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function TeacherList() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchTeachers() {
      const supabase = createClient();

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      const teacherList = (data ?? []) as User[];
      setTeachers(teacherList);

      // Fetch student counts for each teacher
      const counts: Record<string, number> = {};
      for (const teacher of teacherList) {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', teacher.id)
          .eq('role', 'student');
        counts[teacher.id] = count ?? 0;
      }
      setStudentCounts(counts);
      setLoading(false);
    }

    fetchTeachers();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="교사 목록을 불러오는 중..." />
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        등록된 교사가 없습니다
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted-light border-b border-border">
            <th className="text-left px-4 py-3 font-medium text-muted">이름</th>
            <th className="text-left px-4 py-3 font-medium text-muted">이메일</th>
            <th className="text-left px-4 py-3 font-medium text-muted">학교</th>
            <th className="text-center px-4 py-3 font-medium text-muted">학년</th>
            <th className="text-center px-4 py-3 font-medium text-muted">반</th>
            <th className="text-center px-4 py-3 font-medium text-muted">학생 수</th>
            <th className="text-center px-4 py-3 font-medium text-muted">가입일</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => (
            <tr
              key={teacher.id}
              onClick={() =>
                setExpandedId(expandedId === teacher.id ? null : teacher.id)
              }
              className="border-b border-border last:border-b-0 hover:bg-card-hover cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-medium">
                {teacher.nickname ?? '이름 없음'}
              </td>
              <td className="px-4 py-3 text-muted">{teacher.email ?? '-'}</td>
              <td className="px-4 py-3">{teacher.school ?? '-'}</td>
              <td className="px-4 py-3 text-center">
                {teacher.grade ? `${teacher.grade}학년` : '-'}
              </td>
              <td className="px-4 py-3 text-center">{teacher.class ?? '-'}</td>
              <td className="px-4 py-3 text-center font-medium">
                {studentCounts[teacher.id] ?? 0}명
              </td>
              <td className="px-4 py-3 text-center text-muted text-xs">
                {new Date(teacher.created_at).toLocaleDateString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
