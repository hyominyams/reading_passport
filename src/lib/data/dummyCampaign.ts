import type { Campaign, CampaignAssetMeta, CampaignContentType, SubmissionStatus } from '@/types/database';

export interface SampleSubmission {
  id: string;
  campaign_id: string;
  student_id: string;
  content_type: CampaignContentType;
  title: string;
  description: string | null;
  assets: CampaignAssetMeta[];
  status: SubmissionStatus;
  created_at: string;
  student: { id: string; nickname: string | null; avatar: string | null };
  like_count: number;
  liked_by_me: boolean;
}

export const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id: 'sample-1',
    title: '우리 반 세계시장 포스터전',
    description:
      '각 나라 그림책을 읽고 지역 시장, 음식, 직업 문화를 포스터와 카드뉴스로 재해석한 결과물을 모아 전시합니다. 자유롭게 디자인하되, 나라의 문화가 잘 드러나도록 해 주세요.',
    cover_image_url: null,
    allowed_content_types: ['poster', 'card_news'],
    tags: ['전시', '포스터', '문화비교'],
    status: 'active',
    deadline: '2026-04-30T23:59:59Z',
    max_files_per_submission: 3,
    max_file_size_mb: 5,
    created_by: 'teacher-1',
    class_id: null,
    scope: 'class',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'sample-2',
    title: '등장인물 인터뷰집 배포팩',
    description:
      '학생들이 만든 등장인물 인터뷰 질문지와 응답 기록을 교실 배포용 PDF로 묶어 공유하는 자료 아카이브입니다. 인터뷰 형식으로 작성해 주세요.',
    cover_image_url: null,
    allowed_content_types: ['worksheet', 'other'],
    tags: ['질문지', '배포자료', '토론'],
    status: 'active',
    deadline: '2026-05-15T23:59:59Z',
    max_files_per_submission: 5,
    max_file_size_mb: 10,
    created_by: 'teacher-1',
    class_id: null,
    scope: 'class',
    created_at: '2026-04-03T00:00:00Z',
    updated_at: '2026-04-03T00:00:00Z',
  },
  {
    id: 'sample-3',
    title: '숨은 이야기 탐험 키트',
    description:
      'Hidden Stories 활동을 수업 바깥으로 확장해 지도, 조사 카드, 사진 기록지를 함께 묶은 탐험형 자료 꾸러미입니다.',
    cover_image_url: null,
    allowed_content_types: ['culture_intro', 'impression'],
    tags: ['탐험', '프로젝트', '조사'],
    status: 'active',
    deadline: null,
    max_files_per_submission: 3,
    max_file_size_mb: 5,
    created_by: 'teacher-1',
    class_id: null,
    scope: 'class',
    created_at: '2026-04-05T00:00:00Z',
    updated_at: '2026-04-05T00:00:00Z',
  },
  {
    id: 'sample-4',
    title: '나라별 음식 문화 감상문 챌린지',
    description:
      '그림책에 등장하는 음식 문화를 읽고 감상문을 써 보세요. 가장 인상 깊었던 음식과 그 이유를 자유롭게 표현해 주세요.',
    cover_image_url: null,
    allowed_content_types: ['impression'],
    tags: ['감상문', '음식', '챌린지'],
    status: 'active',
    deadline: '2026-04-20T23:59:59Z',
    max_files_per_submission: 2,
    max_file_size_mb: 5,
    created_by: 'teacher-1',
    class_id: null,
    scope: 'class',
    created_at: '2026-04-07T00:00:00Z',
    updated_at: '2026-04-07T00:00:00Z',
  },
];

const sampleImages = [
  'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop',
];

const SAMPLE_SUBMISSIONS: Record<string, SampleSubmission[]> = {
  'sample-1': [
    {
      id: 'sample-sub-1',
      campaign_id: 'sample-1',
      student_id: 'sample-student-1',
      content_type: 'poster',
      title: '콜롬비아 시장의 색깔',
      description: '콜롬비아 전통 시장에서 만날 수 있는 과일과 꽃의 색감을 담아 포스터로 만들었어요.',
      assets: [{ id: 'asset-1', name: 'poster-1.jpg', size_bytes: 820000, type: 'image', storage_path: sampleImages[0], public_url: sampleImages[0] }],
      status: 'featured',
      created_at: '2026-04-08T10:00:00Z',
      student: { id: 'sample-student-1', nickname: '지민', avatar: 'bear' },
      like_count: 12,
      liked_by_me: false,
    },
    {
      id: 'sample-sub-2',
      campaign_id: 'sample-1',
      student_id: 'sample-student-2',
      content_type: 'card_news',
      title: '탄자니아 마사이 마을 카드뉴스',
      description: '마사이 마을의 하루를 카드뉴스 형식으로 정리했습니다.',
      assets: [
        { id: 'asset-2', name: 'card-1.jpg', size_bytes: 640000, type: 'image', storage_path: sampleImages[1], public_url: sampleImages[1] },
        { id: 'asset-3', name: 'card-2.jpg', size_bytes: 580000, type: 'image', storage_path: sampleImages[2], public_url: sampleImages[2] },
      ],
      status: 'submitted',
      created_at: '2026-04-08T14:30:00Z',
      student: { id: 'sample-student-2', nickname: '서연', avatar: 'rabbit' },
      like_count: 8,
      liked_by_me: false,
    },
    {
      id: 'sample-sub-3',
      campaign_id: 'sample-1',
      student_id: 'sample-student-3',
      content_type: 'poster',
      title: '캄보디아 앙코르와트 여행 포스터',
      description: '앙코르와트의 신비로운 석양을 배경으로 한 여행 포스터입니다.',
      assets: [{ id: 'asset-4', name: 'poster-2.jpg', size_bytes: 750000, type: 'image', storage_path: sampleImages[3], public_url: sampleImages[3] }],
      status: 'submitted',
      created_at: '2026-04-09T09:15:00Z',
      student: { id: 'sample-student-3', nickname: '하준', avatar: 'fox' },
      like_count: 5,
      liked_by_me: false,
    },
  ],
  'sample-2': [
    {
      id: 'sample-sub-4',
      campaign_id: 'sample-2',
      student_id: 'sample-student-4',
      content_type: 'worksheet',
      title: '사자와 소년 주인공 인터뷰',
      description: '탄자니아 이야기 속 소년에게 직접 질문을 던져보았습니다.',
      assets: [{ id: 'asset-5', name: 'interview.jpg', size_bytes: 420000, type: 'image', storage_path: sampleImages[4], public_url: sampleImages[4] }],
      status: 'featured',
      created_at: '2026-04-07T16:00:00Z',
      student: { id: 'sample-student-4', nickname: '윤아', avatar: 'cat' },
      like_count: 15,
      liked_by_me: false,
    },
    {
      id: 'sample-sub-5',
      campaign_id: 'sample-2',
      student_id: 'sample-student-5',
      content_type: 'other',
      title: '히말라야 아이와의 대화',
      description: '네팔 이야기의 주인공에게 편지 형식으로 인터뷰를 진행했어요.',
      assets: [{ id: 'asset-6', name: 'letter.jpg', size_bytes: 380000, type: 'image', storage_path: sampleImages[0], public_url: sampleImages[0] }],
      status: 'submitted',
      created_at: '2026-04-08T11:00:00Z',
      student: { id: 'sample-student-5', nickname: '수아', avatar: 'bear' },
      like_count: 7,
      liked_by_me: false,
    },
  ],
  'sample-3': [
    {
      id: 'sample-sub-6',
      campaign_id: 'sample-3',
      student_id: 'sample-student-1',
      content_type: 'culture_intro',
      title: '케냐 사바나 탐험 기록',
      description: '케냐 사바나의 동물과 자연환경을 조사하고 기록했습니다.',
      assets: [
        { id: 'asset-7', name: 'explore-1.jpg', size_bytes: 520000, type: 'image', storage_path: sampleImages[1], public_url: sampleImages[1] },
        { id: 'asset-8', name: 'explore-2.jpg', size_bytes: 490000, type: 'image', storage_path: sampleImages[2], public_url: sampleImages[2] },
      ],
      status: 'submitted',
      created_at: '2026-04-06T13:00:00Z',
      student: { id: 'sample-student-1', nickname: '지민', avatar: 'bear' },
      like_count: 10,
      liked_by_me: false,
    },
    {
      id: 'sample-sub-7',
      campaign_id: 'sample-3',
      student_id: 'sample-student-3',
      content_type: 'impression',
      title: '캄보디아 메콩강 문화 소개',
      description: '메콩강 주변 사람들의 생활 방식을 감상문으로 정리했어요.',
      assets: [{ id: 'asset-9', name: 'impression.jpg', size_bytes: 350000, type: 'image', storage_path: sampleImages[3], public_url: sampleImages[3] }],
      status: 'submitted',
      created_at: '2026-04-07T10:30:00Z',
      student: { id: 'sample-student-3', nickname: '하준', avatar: 'fox' },
      like_count: 3,
      liked_by_me: false,
    },
  ],
  'sample-4': [
    {
      id: 'sample-sub-8',
      campaign_id: 'sample-4',
      student_id: 'sample-student-2',
      content_type: 'impression',
      title: '콜롬비아 아레파를 먹어보고 싶어요',
      description: '콜롬비아의 전통 음식 아레파에 대한 감상문입니다.',
      assets: [{ id: 'asset-10', name: 'arepa.jpg', size_bytes: 280000, type: 'image', storage_path: sampleImages[4], public_url: sampleImages[4] }],
      status: 'featured',
      created_at: '2026-04-08T15:00:00Z',
      student: { id: 'sample-student-2', nickname: '서연', avatar: 'rabbit' },
      like_count: 9,
      liked_by_me: false,
    },
    {
      id: 'sample-sub-9',
      campaign_id: 'sample-4',
      student_id: 'sample-student-4',
      content_type: 'impression',
      title: '네팔 달밧 이야기',
      description: '네팔의 전통 음식 달밧에 대해 알아보고 감상을 적었습니다.',
      assets: [{ id: 'asset-11', name: 'dal-bhat.jpg', size_bytes: 310000, type: 'image', storage_path: sampleImages[0], public_url: sampleImages[0] }],
      status: 'submitted',
      created_at: '2026-04-09T08:00:00Z',
      student: { id: 'sample-student-4', nickname: '윤아', avatar: 'cat' },
      like_count: 4,
      liked_by_me: false,
    },
  ],
};

export function isSampleCampaignId(id: string): boolean {
  return id.startsWith('sample-');
}

export function getSampleCampaign(id: string): Campaign | undefined {
  return SAMPLE_CAMPAIGNS.find((c) => c.id === id);
}

export function getSampleSubmissions(campaignId: string): SampleSubmission[] {
  return SAMPLE_SUBMISSIONS[campaignId] ?? [];
}
