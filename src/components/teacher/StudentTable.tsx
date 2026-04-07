'use client';

import { useState, useMemo } from 'react';
import type { User, Activity, Book } from '@/types/database';

type FilterType = 'all' | 'in_progress' | 'completed' | 'not_started';
type SortType = 'recent' | 'completion';

interface StudentWithActivity extends User {
  currentActivity?: Activity & { book?: Book };
  hasFlaggedChat?: boolean;
}

interface StudentTableProps {
  students: StudentWithActivity[];
  onSelectStudent: (student: StudentWithActivity) => void;
}

export default function StudentTable({ students, onSelectStudent }: StudentTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');

  const getStatus = (student: StudentWithActivity): FilterType => {
    if (!student.currentActivity) return 'not_started';
    const stamps = student.currentActivity.stamps_earned?.length ?? 0;
    return stamps >= 4 ? 'completed' : 'in_progress';
  };

  const getStampDisplay = (student: StudentWithActivity) => {
    if (!student.currentActivity) return '-';
    const stamps = student.currentActivity.stamps_earned?.length ?? 0;
    return stamps >= 4 ? `4/4` : `${stamps}/4`;
  };

  const getLastActivity = (student: StudentWithActivity) => {
    if (!student.currentActivity) return '미시작';
    const date = new Date(student.currentActivity.created_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    return `${diffDays}일전`;
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...students];

    // Apply filter
    if (filter !== 'all') {
      result = result.filter((s) => getStatus(s) === filter);
    }

    // Apply sort
    result.sort((a, b) => {
      if (sort === 'recent') {
        const dateA = a.currentActivity?.created_at ?? '';
        const dateB = b.currentActivity?.created_at ?? '';
        return dateB.localeCompare(dateA);
      }
      const stampsA = a.currentActivity?.stamps_earned?.length ?? 0;
      const stampsB = b.currentActivity?.stamps_earned?.length ?? 0;
      return stampsB - stampsA;
    });

    return result;
  }, [students, filter, sort]);

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'in_progress', label: '진행중' },
    { value: 'completed', label: '완료' },
    { value: 'not_started', label: '미시작' },
  ];

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'recent', label: '최근 활동순' },
    { value: 'completion', label: '완료율순' },
  ];

  return (
    <div>
      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-muted-light rounded-lg p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
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
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white"
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
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted-light border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted">이름</th>
              <th className="text-left px-4 py-3 font-medium text-muted">현재 책</th>
              <th className="text-center px-4 py-3 font-medium text-muted">도장</th>
              <th className="text-center px-4 py-3 font-medium text-muted">최근활동</th>
              <th className="text-center px-4 py-3 font-medium text-muted">알림</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted">
                  {filter === 'all'
                    ? '아직 학생이 없습니다'
                    : '해당 조건의 학생이 없습니다'}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((student) => {
                const stamps = student.currentActivity?.stamps_earned?.length ?? 0;
                const isComplete = stamps >= 4;
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
                      {student.currentActivity?.book?.title ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={isComplete ? 'text-success font-medium' : ''}>
                        {getStampDisplay(student)}
                        {isComplete && ' \u2705'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted">
                      {getLastActivity(student)}
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
