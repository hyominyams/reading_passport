'use client';

import { useState, useMemo } from 'react';
import type { User, Activity, Book } from '@/types/database';

type FilterType = 'all' | 'active' | 'has_completed' | 'not_started';
type SortType = 'recent' | 'completion' | 'name';

interface StudentWithActivity extends User {
  allActivities: (Activity & { book?: Book })[];
  hasFlaggedChat?: boolean;
}

interface StudentTableProps {
  students: StudentWithActivity[];
  onSelectStudent: (student: StudentWithActivity) => void;
}

function getCompletedCount(student: StudentWithActivity) {
  return student.allActivities.filter((a) => (a.stamps_earned?.length ?? 0) >= 4).length;
}

function getInProgressCount(student: StudentWithActivity) {
  return student.allActivities.filter((a) => {
    const stamps = a.stamps_earned?.length ?? 0;
    return stamps > 0 && stamps < 4;
  }).length;
}

function getLatestActivity(student: StudentWithActivity) {
  return student.allActivities[0]; // already sorted by created_at desc
}

function getStatus(student: StudentWithActivity): 'active' | 'has_completed' | 'not_started' {
  if (student.allActivities.length === 0) return 'not_started';
  if (getCompletedCount(student) > 0) return 'has_completed';
  return 'active';
}

function getLastActivityLabel(student: StudentWithActivity) {
  const latest = getLatestActivity(student);
  if (!latest) return '미시작';
  const date = new Date(latest.created_at);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

export default function StudentTable({ students, onSelectStudent }: StudentTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [query, setQuery] = useState('');

  const filteredAndSorted = useMemo(() => {
    let result = [...students];

    if (query.trim()) {
      const normalizedQuery = query.trim().toLowerCase();
      result = result.filter((student) => {
        const bookTitles = student.allActivities.map((a) => a.book?.title ?? '').join(' ');
        const haystack = [student.nickname, student.class, bookTitles]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    if (filter !== 'all') {
      result = result.filter((s) => getStatus(s) === filter);
    }

    result.sort((a, b) => {
      if (sort === 'recent') {
        const dateA = getLatestActivity(a)?.created_at ?? '';
        const dateB = getLatestActivity(b)?.created_at ?? '';
        return dateB.localeCompare(dateA);
      }
      if (sort === 'completion') {
        return getCompletedCount(b) - getCompletedCount(a);
      }
      return (a.nickname ?? '').localeCompare(b.nickname ?? '');
    });

    return result;
  }, [students, filter, query, sort]);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'active', label: '진행중' },
    { value: 'has_completed', label: '완료 있음' },
    { value: 'not_started', label: '미시작' },
  ];

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'recent', label: '최근 활동순' },
    { value: 'completion', label: '완료 여권순' },
    { value: 'name', label: '이름순' },
  ];

  return (
    <div>
      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="학생, 반, 책 제목 검색"
          className="min-w-[220px] rounded-xl border border-border bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
        />
        <div className="flex gap-1 bg-muted-light rounded-xl p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-xl transition-colors ${
                filter === opt.value
                  ? 'bg-white text-foreground font-medium shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="px-3 py-2 text-sm border border-border rounded-xl bg-white"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted ml-auto">
          총 {filteredAndSorted.length}명
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-light/70 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted">이름</th>
              <th className="text-left px-4 py-3 font-medium text-muted">반</th>
              <th className="text-center px-4 py-3 font-medium text-muted">여권</th>
              <th className="text-left px-4 py-3 font-medium text-muted">현재 책</th>
              <th className="text-center px-4 py-3 font-medium text-muted">최근활동</th>
              <th className="text-center px-4 py-3 font-medium text-muted">알림</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted">
                  {filter === 'all'
                    ? '아직 학생이 없습니다'
                    : '해당 조건의 학생이 없습니다'}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((student) => {
                const completedCount = getCompletedCount(student);
                const inProgressCount = getInProgressCount(student);
                const latest = getLatestActivity(student);
                const latestStamps = latest?.stamps_earned?.length ?? 0;

                return (
                  <tr
                    key={student.id}
                    onClick={() => onSelectStudent(student)}
                    className="border-b border-border last:border-b-0 hover:bg-card-hover cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {student.hasFlaggedChat && (
                          <span className="text-error" title="플래그된 대화">
                            &#9888;&#65039;
                          </span>
                        )}
                        <span className="font-medium">{student.nickname ?? '이름 없음'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {student.class ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.allActivities.length === 0 ? (
                        <span className="text-muted">-</span>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {completedCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                              {completedCount}권 완료
                            </span>
                          )}
                          {inProgressCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                              {inProgressCount}권 진행
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {latest ? (
                        <div className="flex items-center gap-2">
                          <span className="text-foreground truncate max-w-[140px]">
                            {latest.book?.title ?? '-'}
                          </span>
                          <span className={`text-xs font-medium shrink-0 ${latestStamps >= 4 ? 'text-emerald-600' : 'text-muted'}`}>
                            {latestStamps}/4
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-muted">
                      {getLastActivityLabel(student)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.hasFlaggedChat && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-error/10 text-error rounded-full">
                          플래그
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
