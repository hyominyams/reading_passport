import type { LibraryStoryItem } from '@/components/story/LibraryGrid';

// GPT-generated local cover images for copyright-safe demo data.
const covers = {
  colombia: [
    '/generated-copyright-safe/library-colombia-butterfly.jpg',
    '/generated-copyright-safe/library-colombia-amazon-song.jpg',
    '/generated-copyright-safe/library-colombia-river-star.jpg',
    '/generated-copyright-safe/library-colombia-secret-garden.jpg',
  ],
  tanzania: [
    '/generated-copyright-safe/library-tanzania-warrior.jpg',
    '/generated-copyright-safe/library-tanzania-giraffe.jpg',
    '/generated-copyright-safe/library-tanzania-baobab.jpg',
    '/generated-copyright-safe/library-tanzania-cloud.jpg',
    '/generated-copyright-safe/library-tanzania-zanzibar.jpg',
  ],
  cambodia: [
    '/generated-copyright-safe/library-cambodia-stone.jpg',
    '/generated-copyright-safe/library-cambodia-guardian.jpg',
    '/generated-copyright-safe/library-cambodia-floating-school.jpg',
    '/generated-copyright-safe/library-cambodia-lotus.jpg',
  ],
  nepal: [
    '/generated-copyright-safe/library-nepal-everest-flower.jpg',
    '/generated-copyright-safe/library-nepal-echo.jpg',
    '/generated-copyright-safe/library-nepal-alley.jpg',
  ],
  kenya: [
    '/generated-copyright-safe/library-kenya-maasai.jpg',
    '/generated-copyright-safe/library-kenya-nairobi.jpg',
    '/generated-copyright-safe/library-kenya-flamingo.jpg',
  ],
};

const dummyStories: {
  countryId: string;
  bookTitle: string;
  stories: { title: string; author: string; likes: number; views: number }[];
}[] = [
  // Colombia - 4 stories
  {
    countryId: 'colombia',
    bookTitle: '마법의 나비',
    stories: [
      { title: '무지개 날개를 가진 나비', author: '지민', likes: 42, views: 180 },
      { title: '아마존의 숨겨진 노래', author: '서연', likes: 28, views: 120 },
    ],
  },
  {
    countryId: 'colombia',
    bookTitle: '강의 노래',
    stories: [
      { title: '콜롬비아의 별이 된 소녀', author: '하준', likes: 35, views: 145 },
      { title: '카르타헤나의 비밀 정원', author: '윤아', likes: 19, views: 88 },
    ],
  },
  // Tanzania - 5 stories
  {
    countryId: 'tanzania',
    bookTitle: '사자와 소년',
    stories: [
      { title: '세렝게티의 용감한 전사', author: '수아', likes: 56, views: 230 },
      { title: '달빛 아래 춤추는 기린', author: '도윤', likes: 31, views: 140 },
      { title: '바오밥 나무의 약속', author: '하은', likes: 22, views: 95 },
    ],
  },
  {
    countryId: 'tanzania',
    bookTitle: '킬리만자로의 꿈',
    stories: [
      { title: '구름 위를 걷는 아이', author: '예은', likes: 38, views: 160 },
      { title: '잔지바르 해변의 보물', author: '시우', likes: 15, views: 72 },
    ],
  },
  // Cambodia - 4 stories
  {
    countryId: 'cambodia',
    bookTitle: '앙코르의 비밀',
    stories: [
      { title: '천년의 돌이 들려준 이야기', author: '민서', likes: 33, views: 150 },
      { title: '앙코르와트의 수호 정령', author: '준호', likes: 25, views: 110 },
    ],
  },
  {
    countryId: 'cambodia',
    bookTitle: '메콩강 아이들',
    stories: [
      { title: '떠다니는 마을의 학교', author: '유나', likes: 29, views: 125 },
      { title: '연꽃 위의 소원', author: '태현', likes: 17, views: 80 },
    ],
  },
  // Nepal - 3 stories
  {
    countryId: 'nepal',
    bookTitle: '히말라야의 아이',
    stories: [
      { title: '에베레스트에 핀 꽃 한 송이', author: '소율', likes: 44, views: 190 },
      { title: '설산의 메아리', author: '건우', likes: 20, views: 90 },
      { title: '카트만두 골목의 마법사', author: '다은', likes: 13, views: 60 },
    ],
  },
  // Kenya - 3 stories
  {
    countryId: 'kenya',
    bookTitle: '사바나의 노래',
    stories: [
      { title: '마사이 소년의 첫 번째 모험', author: '지호', likes: 37, views: 155 },
      { title: '나이로비의 꿈꾸는 소녀', author: '서윤', likes: 24, views: 105 },
      { title: '플라밍고 호수의 전설', author: '은서', likes: 11, views: 50 },
    ],
  },
];

const pageTemplates = [
  [
    '먼 나라에 작은 마을이 있었어요. 그 마을에는 특별한 나무 한 그루가 자라고 있었죠.',
    '어느 날, 한 아이가 그 나무 아래에서 반짝이는 무언가를 발견했어요. 그것은 오래된 이야기가 담긴 돌이었답니다.',
    '아이는 돌에 새겨진 이야기를 마을 사람들에게 전해주었고, 그때부터 마을에는 매일 밤 이야기꽃이 피어났어요.',
  ],
  [
    '높은 산 위에 구름 마을이 있었어요. 그곳의 아이들은 매일 아침 무지개 다리를 건너 학교에 갔죠.',
    '어느 비 오는 날, 무지개 다리가 사라져 버렸어요. 아이들은 힘을 합쳐 새로운 길을 찾기로 했답니다.',
    '함께 노래를 부르자 하늘에서 새로운 무지개가 내려왔어요. 우정의 힘이 만든 가장 아름다운 다리였죠.',
  ],
  [
    '깊은 바다 속에 작은 물고기 하나가 살고 있었어요. 이름은 파랑이었죠. 파랑이는 늘 수면 위 세상이 궁금했어요.',
    '용기를 내어 수면 위로 올라간 파랑이는 처음으로 하늘의 별을 보았어요. 너무나 아름다워서 눈물이 날 뻔했죠.',
    '파랑이는 바다 속 친구들에게 별 이야기를 들려주었고, 모두 함께 밤바다 위로 올라와 별을 구경했답니다.',
  ],
];

function buildPages(title: string, templateIdx: number): string[] {
  const tpl = pageTemplates[templateIdx % pageTemplates.length];
  return [`${title} — ${tpl[0]}`, ...tpl.slice(1)];
}

let counter = 0;

function makeId(): string {
  counter += 1;
  return `dummy-${counter.toString().padStart(4, '0')}`;
}

export function isDummyId(id: string): boolean {
  return id.startsWith('dummy-');
}

export function generateDummyLibraryItems(): LibraryStoryItem[] {
  counter = 0;
  const items: LibraryStoryItem[] = [];

  for (const group of dummyStories) {
    const bookId = makeId();
    const countryCoverList =
      covers[group.countryId as keyof typeof covers] ?? covers.colombia;

    for (let si = 0; si < group.stories.length; si++) {
      const s = group.stories[si];
      const storyId = makeId();
      const libId = makeId();
      const pageSet = buildPages(s.title, items.length);
      const sceneImgs = pageSet.map(
        (_, pi) => countryCoverList[(items.length + pi) % countryCoverList.length]
      );

      items.push({
        id: libId,
        story_id: storyId,
        country_id: group.countryId,
        book_id: bookId,
        likes: s.likes,
        views: s.views,
        book: {
          id: bookId,
          title: group.bookTitle,
          cover_url: `/generated-copyright-safe/country-${group.countryId}.jpg`,
        },
        story: {
          id: storyId,
          student_id: makeId(),
          book_id: bookId,
          country_id: group.countryId,
          language: 'ko',
          story_type: 'continue',
          custom_input: null,
          chat_log: {},
          all_student_messages: null,
          gauge_final: 80,
          ai_draft: null,
          final_text: pageSet,
          character_refs: null,
          scene_images: sceneImgs,
          translation_text: null,
          translated_texts: null,
          pdf_url_original: null,
          pdf_url_translated: null,
          translated_pdf_urls: null,
          visibility: 'public',
          created_at: new Date().toISOString(),
          author: { nickname: s.author },
        },
      });
    }
  }

  return items;
}
