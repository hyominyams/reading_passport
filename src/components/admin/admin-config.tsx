import type { LucideIcon } from 'lucide-react';
import {
  BookOpenText,
  ChartNoAxesCombined,
  FileCheck2,
  Globe2,
  LibraryBig,
  Lightbulb,
  UsersRound,
} from 'lucide-react';

export type AdminSection =
  | 'overview'
  | 'teachers'
  | 'approvals'
  | 'books'
  | 'hidden'
  | 'library'
  | 'facts';

export interface AdminSectionTone {
  border: string;
  badge: string;
  iconWrap: string;
  iconColor: string;
  panel: string;
  soft: string;
  navActive: string;
  navIdle: string;
}

export interface AdminSectionMeta {
  key: AdminSection;
  label: string;
  shortLabel: string;
  eyebrow: string;
  hint: string;
  description: string;
  icon: LucideIcon;
  requirements: string[];
  tone: AdminSectionTone;
}

export interface AdminCoreCheckItem {
  id: string;
  title: string;
  description: string;
  sections: AdminSection[];
}

export const adminSections: AdminSectionMeta[] = [
  {
    key: 'overview',
    label: '운영 개요',
    shortLabel: '개요',
    eyebrow: 'Mission Control',
    hint: '운영 지표와 최근 변동',
    description: '운영 리스크와 최근 활동을 한눈에 보는 관리자 관제판입니다.',
    icon: ChartNoAxesCombined,
    requirements: ['실시간 지표', '최근 승인/교사/도서 흐름', '운영 리스크 스냅샷'],
    tone: {
      border: 'border-sky-200/80',
      badge: 'border-sky-200 bg-sky-50 text-sky-700',
      iconWrap: 'bg-sky-600/95',
      iconColor: 'text-sky-700',
      panel: 'from-sky-500/18 via-cyan-500/12 to-white',
      soft: 'bg-sky-50/85 text-sky-700',
      navActive: 'border-sky-400 bg-sky-600 text-white shadow-lg shadow-sky-500/20',
      navIdle: 'border-sky-100/70 bg-white/90 text-slate-700 hover:border-sky-300 hover:bg-sky-50/80',
    },
  },
  {
    key: 'teachers',
    label: '교사 관리',
    shortLabel: '교사',
    eyebrow: 'People Ops',
    hint: '교사 계정과 학생 drilldown',
    description: '교사 생성, 수정, 비밀번호 재설정, 학생/대화 드릴다운까지 담당합니다.',
    icon: UsersRound,
    requirements: ['교사 계정 생성/수정', '학생 현황 drilldown', '안전 삭제와 권한 유지'],
    tone: {
      border: 'border-emerald-200/80',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      iconWrap: 'bg-emerald-600/95',
      iconColor: 'text-emerald-700',
      panel: 'from-emerald-500/18 via-teal-500/10 to-white',
      soft: 'bg-emerald-50/85 text-emerald-700',
      navActive: 'border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20',
      navIdle: 'border-emerald-100/70 bg-white/90 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/80',
    },
  },
  {
    key: 'approvals',
    label: '승인 센터',
    shortLabel: '승인',
    eyebrow: 'Risk Review',
    hint: '공개 요청 검토와 처리',
    description: '전역 공개 요청을 미리보기와 메모 기반으로 승인 또는 반려합니다.',
    icon: FileCheck2,
    requirements: ['대기/이력 관리', '콘텐츠 미리보기', '검토 메모 기록'],
    tone: {
      border: 'border-amber-200/80',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      iconWrap: 'bg-amber-500/95',
      iconColor: 'text-amber-700',
      panel: 'from-amber-500/18 via-orange-500/10 to-white',
      soft: 'bg-amber-50/85 text-amber-800',
      navActive: 'border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-500/20',
      navIdle: 'border-amber-100/70 bg-white/90 text-slate-700 hover:border-amber-300 hover:bg-amber-50/80',
    },
  },
  {
    key: 'books',
    label: '도서 관리',
    shortLabel: '도서',
    eyebrow: 'Catalog Control',
    hint: '글로벌 도서 CRUD',
    description: '국가별 도서 등록, PDF 연결, 표지와 도서 분석 상태를 관리합니다.',
    icon: BookOpenText,
    requirements: ['도서 등록/수정/삭제', 'PDF/표지 상태 확인', '분석 상태 점검'],
    tone: {
      border: 'border-indigo-200/80',
      badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      iconWrap: 'bg-indigo-600/95',
      iconColor: 'text-indigo-700',
      panel: 'from-indigo-500/18 via-blue-500/10 to-white',
      soft: 'bg-indigo-50/85 text-indigo-700',
      navActive: 'border-indigo-400 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20',
      navIdle: 'border-indigo-100/70 bg-white/90 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/80',
    },
  },
  {
    key: 'hidden',
    label: 'Hidden Stories',
    shortLabel: 'Hidden',
    eyebrow: 'Story Feed',
    hint: '글로벌 Hidden Story 운영',
    description: 'Hidden Stories 피드를 책, 유형, 링크 품질 기준으로 운영하는 영역입니다.',
    icon: Globe2,
    requirements: ['전역 콘텐츠 CRUD', '타입별 품질 관리', '도서 연결 상태 유지'],
    tone: {
      border: 'border-cyan-200/80',
      badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      iconWrap: 'bg-cyan-600/95',
      iconColor: 'text-cyan-700',
      panel: 'from-cyan-500/18 via-teal-500/10 to-white',
      soft: 'bg-cyan-50/85 text-cyan-700',
      navActive: 'border-cyan-400 bg-cyan-600 text-white shadow-lg shadow-cyan-500/20',
      navIdle: 'border-cyan-100/70 bg-white/90 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/80',
    },
  },
  {
    key: 'library',
    label: '서재 운영',
    shortLabel: '서재',
    eyebrow: 'Gallery',
    hint: '작품 노출과 공개 범위 관리',
    description: '학생 작품의 서재 반영 여부와 공개 범위를 관리합니다.',
    icon: LibraryBig,
    requirements: ['작품 노출 제어', '공개 범위 관리', '인기/조회 기반 정렬'],
    tone: {
      border: 'border-rose-200/80',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      iconWrap: 'bg-rose-600/95',
      iconColor: 'text-rose-700',
      panel: 'from-rose-500/18 via-pink-500/10 to-white',
      soft: 'bg-rose-50/85 text-rose-700',
      navActive: 'border-rose-400 bg-rose-600 text-white shadow-lg shadow-rose-500/20',
      navIdle: 'border-rose-100/70 bg-white/90 text-slate-700 hover:border-rose-300 hover:bg-rose-50/80',
    },
  },
  {
    key: 'facts',
    label: '세계 상식',
    shortLabel: '상식',
    eyebrow: 'Knowledge Layer',
    hint: 'country_facts 편집',
    description: 'My World 제작 과정에 쓰이는 나라별 상식 문구를 다국어로 유지합니다.',
    icon: Lightbulb,
    requirements: ['나라별 상식 관리', '한/영 문구 운영', '노출 순서 유지'],
    tone: {
      border: 'border-lime-200/80',
      badge: 'border-lime-200 bg-lime-50 text-lime-700',
      iconWrap: 'bg-lime-600/95',
      iconColor: 'text-lime-700',
      panel: 'from-lime-400/18 via-emerald-400/10 to-white',
      soft: 'bg-lime-50/85 text-lime-700',
      navActive: 'border-lime-400 bg-lime-600 text-white shadow-lg shadow-lime-500/20',
      navIdle: 'border-lime-100/70 bg-white/90 text-slate-700 hover:border-lime-300 hover:bg-lime-50/80',
    },
  },
];

export const adminSectionMap = Object.fromEntries(
  adminSections.map((section) => [section.key, section])
) as Record<AdminSection, AdminSectionMeta>;

export const adminCoreChecklist: AdminCoreCheckItem[] = [
  {
    id: 'teacher-accounts',
    title: '교사 계정 라이프사이클',
    description: '생성, 수정, 비밀번호 재설정, 안전 삭제',
    sections: ['teachers'],
  },
  {
    id: 'teacher-drilldown',
    title: '학생/대화 drilldown',
    description: '교사별 학생 활동과 플래그 대화 확인',
    sections: ['teachers'],
  },
  {
    id: 'approval-review',
    title: '전역 공개 승인 검토',
    description: '요청 이력, 미리보기, 검토 메모',
    sections: ['approvals'],
  },
  {
    id: 'content-ops',
    title: '전역 콘텐츠 운영',
    description: '도서와 Hidden Stories의 직접 관리',
    sections: ['books', 'hidden'],
  },
  {
    id: 'library-moderation',
    title: '서재 관리',
    description: '노출 여부와 공개 범위 관리',
    sections: ['library'],
  },
  {
    id: 'facts-ops',
    title: '세계 상식 데이터',
    description: '나라별 fact 문구 유지',
    sections: ['facts'],
  },
];

export function isAdminSection(value: string | null): value is AdminSection {
  return adminSections.some((section) => section.key === value);
}
