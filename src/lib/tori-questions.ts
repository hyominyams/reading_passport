/**
 * Tori question card definitions for the 12 docent-recommended activities.
 *
 * Each activity has its own card set. Cards collect the structural pieces
 * (start point, conflict, helper, ending) the AI draft generator needs to
 * write a 5-scene picture book draft.
 *
 * Question titles support variables (${country}, ${protagonist}) that get
 * replaced at render time with the book's country name and main character.
 *
 * Hints are gray example texts shown below the input. They are NOT clickable
 * — students must type their own answer. Hints are also country-neutral so
 * the same card set works for any book in any country.
 */

export type ToriCardQuestion = {
  /** Stable key within the activity. Used as the answer storage key. */
  key: string;
  /** Question text, may contain ${country} or ${protagonist} variables. */
  title: string;
  /** Country-neutral hint examples shown as gray text below the input. */
  hints: string[];
  /** Number of textarea rows. 1 renders as a single-line input. */
  rows: 1 | 2 | 3;
  /** When true, student must answer before proceeding. */
  required: boolean;
  /** Maximum character length for the textarea. */
  maxLength: number;
};

export type ToriCardSet = {
  activity_id: string;
  /** Short label shown above the cards (the activity title). */
  activity_title: string;
  cards: ToriCardQuestion[];
};

export type ToriAnswers = {
  activity_id: string;
  answers: Record<string, string>;
};

export type ToriActivityLike = {
  id?: string | null;
  title?: string | null;
};

export type ToriRenderVars = {
  country?: string;
  protagonist?: string;
};

const TORI_QUESTION_SETS: Record<string, ToriCardSet> = {
  /* ── Group A: New time / event ── */

  continue_story: {
    activity_id: 'continue_story',
    activity_title: '다음 이야기 만들기',
    cards: [
      {
        key: 'start_event',
        title: '책이 끝난 다음 날, ${protagonist}은 어디서 무엇을 하고 있어?',
        hints: [
          '주인공이 매일 가는 곳에서',
          '가족과 함께 있는 시간에',
          '친구를 만나러 가는 길에',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'new_event',
        title: '그 일상 속에서 어떤 새 일이 벌어져?',
        hints: [
          '한 번도 만난 적 없는 사람을 마주친다',
          '익숙한 풍경이 갑자기 달라진다',
          '잃어버린 줄 알았던 것을 다시 찾는다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'helper',
        title: '누가 또는 뭐가 도와줄까?',
        hints: [
          '용기 있는 친구',
          '현명한 어른',
          '내 안의 용기',
          '작은 기적',
        ],
        rows: 2,
        required: false,
        maxLength: 150,
      },
      {
        key: 'ending',
        title: '이번엔 어떤 결말이면 좋겠어?',
        hints: [
          '주인공이 새로운 마음을 얻는다',
          '바라던 일이 이뤄진다',
          '다음을 기약하며 마무리된다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  before_story: {
    activity_id: 'before_story',
    activity_title: '처음 전 이야기 만들기',
    cards: [
      {
        key: 'timeframe',
        title: '책이 시작되기 얼마 전의 이야기야?',
        hints: [
          '어릴 적',
          '며칠 전',
          '한 해 전',
          '큰 일이 일어나기 직전',
        ],
        rows: 1,
        required: true,
        maxLength: 80,
      },
      {
        key: 'past_state',
        title: '그때 ${protagonist}은 어떤 모습이었어? 마음은 어땠어?',
        hints: [
          '지금과 다른 모습이었다',
          '무언가를 모르고 있었다',
          '평온한 일상을 보내고 있었다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'origin_event',
        title: '어떤 사건이 책 속의 ${protagonist}을 만든 거야?',
        hints: [
          '누군가를 잃었다',
          '큰 변화를 겪었다',
          '새로운 사실을 알게 됐다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'ending',
        title: '그 일이 어떻게 마무리되고 책이 시작돼?',
        hints: [
          '새 결심을 안고',
          '변화된 마음으로',
          '풀리지 않은 채로',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  new_problem_story: {
    activity_id: 'new_problem_story',
    activity_title: '또 다른 어려움 만나기',
    cards: [
      {
        key: 'new_problem',
        title: '책이 끝난 뒤, ${protagonist}은 또 어떤 새 어려움을 만나?',
        hints: [
          '자연이 갑자기 변했다',
          '가까운 사람과 어긋났다',
          '잘못된 일을 마주쳤다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'why_hard',
        title: '그게 왜 어려운 일이야?',
        hints: [
          '혼자서는 풀 수 없어서',
          '처음 겪는 일이라서',
          '마음이 많이 흔들려서',
        ],
        rows: 2,
        required: true,
        maxLength: 150,
      },
      {
        key: 'helper',
        title: '누가 또는 뭐가 도와줄까?',
        hints: [
          '함께 사는 사람들',
          '자신의 경험',
          '새로 만난 친구',
        ],
        rows: 2,
        required: false,
        maxLength: 150,
      },
      {
        key: 'ending',
        title: '어떻게 풀려?',
        hints: [
          '사람들과 함께 풀어낸다',
          '작은 변화를 만들어낸다',
          '마음의 답을 얻는다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  hidden_scene_story: {
    activity_id: 'hidden_scene_story',
    activity_title: '숨은 장면 이야기 만들기',
    cards: [
      {
        key: 'between_what',
        title: '책의 어느 장면과 어느 장면 사이의 이야기야?',
        hints: [
          '첫 만남 직후',
          '중요한 결정을 내리기 전',
          '누군가를 떠난 뒤',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'what_happened',
        title: '그 사이에 어떤 일이 있었어?',
        hints: [
          '혼자만의 시간을 가졌다',
          '평소와 다른 결정을 내렸다',
          '마음을 정리하는 일이 있었다',
        ],
        rows: 3,
        required: true,
        maxLength: 250,
      },
      {
        key: 'inner_feeling',
        title: '그 일에서 ${protagonist}의 마음은 어땠어?',
        hints: [
          '많이 흔들리는 마음이었다',
          '결심이 단단해졌다',
          '새로운 깨달음을 얻었다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  new_helper_story: {
    activity_id: 'new_helper_story',
    activity_title: '새 친구가 도와주는 이야기 만들기',
    cards: [
      {
        key: 'new_friend',
        title: '어떤 새 친구가 등장해? 이름과 짧은 특징을 적어봐.',
        hints: [
          '또래 친구',
          '지혜로운 어른',
          '주인공과 정반대 성격의 인물',
          '동물 친구',
        ],
        rows: 2,
        required: true,
        maxLength: 150,
      },
      {
        key: 'meeting_moment',
        title: '그 친구가 언제, 어떻게 나타나?',
        hints: [
          '가장 힘들 때',
          '우연한 만남으로',
          '누군가의 소개로',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'how_help',
        title: '함께 어떻게 어려움을 풀어가?',
        hints: [
          '서로의 부족한 점을 채워준다',
          '함께 도전한다',
          '친구가 새로운 시각을 알려준다',
        ],
        rows: 3,
        required: true,
        maxLength: 250,
      },
      {
        key: 'ending',
        title: '어떻게 끝나?',
        hints: [
          '더 단단한 사이가 된다',
          '각자의 길을 간다',
          '다음을 기약한다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  /* ── Group B: Character perspective / replacement ── */

  change_main_character: {
    activity_id: 'change_main_character',
    activity_title: '다른 주인공으로 만들기',
    cards: [
      {
        key: 'new_protagonist',
        title: '이번엔 누가 주인공이야? 이름과 한 줄 특징을 적어봐.',
        hints: [
          '${country}에 사는 호기심 많은 ___',
          '책에 짧게 나온 ___',
          '새로 떠오른 인물 ___',
        ],
        rows: 2,
        required: true,
        maxLength: 150,
      },
      {
        key: 'daily_life',
        title: '그 인물은 어디서, 어떻게 살아?',
        hints: [
          '매일 가는 자기만의 장소가 있다',
          '가족과 함께 있는 시간이 많다',
          '친구들과 어울려 지낸다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'conflict',
        title: '그 인물이 어떤 어려움을 만나?',
        hints: [
          '책의 사건과 비슷한 어려움',
          '다른 종류의 어려움',
          '마음속의 어려움',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'ending',
        title: '어떻게 끝나면 좋겠어?',
        hints: [
          '깨달음을 얻고 마무리된다',
          '변화를 만들어낸다',
          '따뜻한 마무리가 된다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  side_character_story: {
    activity_id: 'side_character_story',
    activity_title: '잠깐 나온 인물 이야기 만들기',
    cards: [
      {
        key: 'which_character',
        title: '책에 잠깐 나온 누구의 이야기를 쓸 거야?',
        hints: [
          '주인공의 친구',
          '잠깐 도와준 어른',
          '한 번 등장한 인물',
        ],
        rows: 1,
        required: true,
        maxLength: 80,
      },
      {
        key: 'daily_life',
        title: '그 사람의 평범한 하루는 어때?',
        hints: [
          '주인공과 만나기 전의 일상',
          '주인공과 만난 후의 일상',
          '책에서 보이지 않은 시간',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'hidden_feeling',
        title: '책에선 안 보이지만, 그 인물의 진짜 마음은?',
        hints: [
          '알려지지 않은 사정이 있다',
          '숨긴 감정이 있다',
          '다른 꿈이 있다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'ending',
        title: '그 하루는 어떻게 끝나?',
        hints: [
          '새 결심을 안고',
          '평소와 같은 마무리로',
          '작은 변화와 함께',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  opposite_perspective: {
    activity_id: 'opposite_perspective',
    activity_title: '다른 인물 눈으로 다시 보기',
    cards: [
      {
        key: 'whose_eyes',
        title: '같은 일을 누구의 눈으로 다시 볼 거야?',
        hints: [
          '주인공이 아닌 인물',
          '잠깐 등장한 인물',
          '갈등 상대 인물',
        ],
        rows: 1,
        required: true,
        maxLength: 80,
      },
      {
        key: 'what_seen',
        title: '그 인물 눈에는 같은 사건이 어떻게 보였어?',
        hints: [
          '다른 의미로 보였다',
          '주인공이 알아채지 못한 것을 봤다',
          '더 가까이서 봤다',
        ],
        rows: 3,
        required: true,
        maxLength: 250,
      },
      {
        key: 'feeling_change',
        title: '그 인물의 마음이 어떻게 변해?',
        hints: [
          '처음과 끝의 마음이 다르다',
          '한 가지 생각이 단단해진다',
          '새 감정을 알게 된다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  /* ── Group C: Branching ── */

  change_ending: {
    activity_id: 'change_ending',
    activity_title: '다른 결말 만들기',
    cards: [
      {
        key: 'branching_point',
        title: '결말의 어느 장면부터 달라지면 좋겠어?',
        hints: [
          '마지막 결정 직전',
          '누군가를 만나는 순간',
          '갈림길에 선 순간',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'different_choice',
        title: '거기서 ${protagonist}이 어떤 다른 선택이나 일을 만나?',
        hints: [
          '다른 길을 택한다',
          '새 사실을 알게 된다',
          '뜻밖의 도움을 받는다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'new_ending',
        title: '어떤 새 결말?',
        hints: [
          '다른 결과를 얻는다',
          '다른 사람이 된다',
          '기대하지 않은 곳에 도착한다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  change_choice: {
    activity_id: 'change_choice',
    activity_title: '다른 선택 이야기 만들기',
    cards: [
      {
        key: 'choice_moment',
        title: '어느 순간에 ${protagonist}이 다른 선택을 해?',
        hints: [
          '마음이 흔들리던 순간',
          '누군가의 말을 따랐던 순간',
          '두려워서 멈췄던 순간',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'different_choice',
        title: '어떤 다른 선택을 해?',
        hints: [
          '더 용기를 낸다',
          '한 번 더 묻는다',
          '가만히 있지 않는다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'result',
        title: '그 결과 어떻게 끝나?',
        hints: [
          '길이 새로 열린다',
          '새 사람을 만난다',
          '다른 마음을 얻는다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  /* ── Group D: New story ── */

  same_message_new_story: {
    activity_id: 'same_message_new_story',
    activity_title: '같은 마음을 담은 새 이야기 만들기',
    cards: [
      {
        key: 'inherited_feeling',
        title: '책에서 받은 어떤 마음을 새 이야기에 담을 거야?',
        hints: [
          '함께한다는 마음',
          '작은 일도 소중하다는 마음',
          '누군가를 이해하려는 마음',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'new_protagonist',
        title: '새 주인공은 누구? 이름과 한 줄 특징을 적어봐.',
        hints: [
          '${country}에 사는 또래 친구',
          '${country}에 사는 가족 중 한 명',
          '한 번도 본 적 없는 새 인물',
        ],
        rows: 2,
        required: true,
        maxLength: 150,
      },
      {
        key: 'country_scene',
        title: '${country}의 어떤 풍경이 새 이야기에 들어가면 좋겠어?',
        hints: [
          '주인공이 매일 보는 풍경',
          '특별한 시간의 풍경',
          '가족과 함께한 장면',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'conflict',
        title: '그 인물이 어떤 어려움을 겪어?',
        hints: [
          '책 속 인물과 비슷한 어려움',
          '새로운 종류의 어려움',
          '자신과의 갈등',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'ending',
        title: '어떤 결말이면 좋겠어?',
        hints: [
          '책과 같은 마음으로 마무리된다',
          '더 큰 깨달음으로 끝난다',
          '새로 시작하는 마무리가 된다',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },

  change_setting: {
    activity_id: 'change_setting',
    activity_title: '다른 장소에서 다시 만들기',
    cards: [
      {
        key: 'new_setting',
        title: '같은 일이 어디서 벌어지면 좋겠어?',
        hints: [
          '${country} 안의 다른 마을',
          '다른 나라',
          '큰 도시',
          '자연 한가운데',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'setting_difference',
        title: '장소가 바뀌면 뭐가 새로 보여?',
        hints: [
          '다른 모습의 사람들',
          '다른 환경의 어려움',
          '다른 종류의 기쁨',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
      {
        key: 'ending',
        title: '새 장소에서는 어떻게 끝나?',
        hints: [
          '책과 같은 결말로',
          '장소 덕분에 다른 결말로',
          '새 곳에 자리잡으며',
        ],
        rows: 2,
        required: true,
        maxLength: 200,
      },
    ],
  },
};

/* ── Public helpers ── */

/**
 * Fallback card set for student-defined custom activities (the "내가 정한
 * 활동" path) and any unknown activity id. Two open questions that still
 * give the draft generator enough structure to write 5 scenes.
 */
const FALLBACK_CUSTOM_SET: ToriCardSet = {
  activity_id: '_custom',
  activity_title: '내가 정한 활동',
  cards: [
    {
      key: 'plan',
      title: '이 이야기를 어떻게 풀어낼 거야? 어디서 시작하고 어떤 일이 벌어지는지 자세히 들려줘.',
      hints: [
        '주인공이 어디서 시작해서',
        '어떤 일이 벌어지고',
        '누가 도와주는지',
      ],
      rows: 3,
      required: true,
      maxLength: 400,
    },
    {
      key: 'ending',
      title: '어떤 결말이면 좋겠어?',
      hints: [
        '주인공이 새로운 마음을 얻는다',
        '함께 무언가를 해낸다',
        '새로 시작하는 마무리가 된다',
      ],
      rows: 2,
      required: true,
      maxLength: 200,
    },
  ],
};

export function resolveToriActivityId(activity: string | ToriActivityLike | null | undefined): string | null {
  const rawId = typeof activity === 'string' ? activity.trim() : activity?.id?.trim();
  if (rawId === '_custom') return '_custom';
  if (rawId && TORI_QUESTION_SETS[rawId]) return rawId;

  const title = typeof activity === 'string' ? activity.trim() : activity?.title?.trim();
  if (!title) return null;
  if (title === FALLBACK_CUSTOM_SET.activity_title) return '_custom';

  const matchedEntry = Object.entries(TORI_QUESTION_SETS).find(([, set]) => set.activity_title === title);
  return matchedEntry?.[0] ?? null;
}

/**
 * Look up the card set for a given activity id or saved activity object. Falls
 * back to the generic custom set when the id/title is missing or unrecognized.
 */
export function getToriCardSet(activity: string | ToriActivityLike | null | undefined): ToriCardSet {
  const resolvedId = resolveToriActivityId(activity);
  if (!resolvedId || resolvedId === '_custom') return FALLBACK_CUSTOM_SET;
  return TORI_QUESTION_SETS[resolvedId] ?? FALLBACK_CUSTOM_SET;
}

/**
 * Render a question title with variable substitution. Falls back to plain
 * Korean replacements when variables are missing so the question stays
 * readable.
 */
export function renderToriTitle(title: string, vars: ToriRenderVars): string {
  return title
    .replace(/\$\{country\}/g, vars.country?.trim() || '이 나라')
    .replace(/\$\{protagonist\}/g, vars.protagonist?.trim() || '주인공');
}

/** Same substitution for hint text. */
export function renderToriHint(hint: string, vars: ToriRenderVars): string {
  return renderToriTitle(hint, vars);
}

/**
 * Build an empty answer map for a card set. Used to seed local component
 * state when the student opens the cards for the first time.
 */
export function buildEmptyToriAnswers(activityId: string): ToriAnswers {
  return { activity_id: activityId, answers: {} };
}

/** Whether all required cards have been answered. */
export function isToriAnswersComplete(set: ToriCardSet, answers: Record<string, string>): boolean {
  return set.cards.every((card) => {
    if (!card.required) return true;
    return (answers[card.key] ?? '').trim().length > 0;
  });
}

/** Normalize an unknown JSON value loaded from the database. */
export function normalizeToriAnswers(raw: unknown): ToriAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { activity_id?: unknown; answers?: unknown };
  const activityId = typeof value.activity_id === 'string' ? value.activity_id : '';
  if (!activityId) return null;

  const answers: Record<string, string> = {};
  if (value.answers && typeof value.answers === 'object') {
    for (const [key, val] of Object.entries(value.answers as Record<string, unknown>)) {
      if (typeof val === 'string') answers[key] = val;
    }
  }

  return { activity_id: activityId, answers };
}

export const TORI_ACTIVITY_IDS = Object.keys(TORI_QUESTION_SETS);
