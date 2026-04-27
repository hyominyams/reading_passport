import { buildAutoNickname, getAvatarEmoji } from '@/lib/profile';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getWorldSmartBadge,
  type MyWorldSmartSummary,
  type WorldSmartAnswerItem,
  type WorldSmartAuthor,
  type WorldSmartBoardData,
  type WorldSmartManagedAnswerItem,
  type WorldSmartManagedBookSummary,
  type WorldSmartManagedPostItem,
  type WorldSmartManagementData,
  type WorldSmartPostItem,
  type WorldSmartQuestionPayload,
} from '@/lib/world-smart';
import type {
  AnswerModerationStatus,
  QuestionBoardCategory,
  UserRole,
} from '@/types/database';

export interface WorldSmartViewerProfile {
  id: string;
  role: UserRole;
  teacher_id: string | null;
  class: string | null;
  nickname: string | null;
  avatar: string | null;
  student_code: string | null;
}

type ServiceUserRow = {
  id: string;
  role: UserRole;
  teacher_id: string | null;
  class: string | null;
  nickname: string | null;
  avatar: string | null;
  student_code: string | null;
};

type ServiceBookRow = {
  id: string;
  title: string | null;
  country_id?: string | null;
  cover_url?: string | null;
};

type ServiceQuestionPostRow = {
  id: string;
  book_id: string;
  student_id: string;
  teacher_id: string;
  class_name: string;
  chat_log_id: string | null;
  question_type: string;
  question_text: string;
  adopted_answer_id: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceQuestionAnswerRow = {
  id: string;
  post_id: string;
  student_id: string;
  answer_text: string;
  moderation_status: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  moderation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export interface WorldSmartManagementFilters {
  bookId?: string | null;
  className?: string | null;
  teacherId?: string | null;
  questionType?: QuestionBoardCategory | 'all' | null;
  status?: 'all' | 'waiting' | 'adopted' | 'hidden' | null;
  query?: string | null;
}

function normalizeClassName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '';
}

function toAuthor(row: ServiceUserRow | undefined): WorldSmartAuthor {
  if (!row) {
    return {
      id: 'unknown',
      nickname: '학생',
      avatarEmoji: null,
    };
  }

  return {
    id: row.id,
    nickname: buildAutoNickname(row),
    avatarEmoji: getAvatarEmoji(row.avatar),
  };
}

function uniqStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeQuestionType(value: string): QuestionBoardCategory | null {
  if (value === 'content' || value === 'character' || value === 'world') {
    return value;
  }

  return null;
}

function normalizeAnswerModerationStatus(value?: string | null): AnswerModerationStatus {
  return value === 'hidden' ? 'hidden' : 'visible';
}

function includesSearchText(values: Array<string | null | undefined>, query?: string | null) {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export async function getWorldSmartViewerProfile(userId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from('users')
    .select('id, role, teacher_id, class, nickname, avatar, student_code')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ServiceUserRow | null);
}

export async function getWorldSmartBoardData(bookId: string, viewer: WorldSmartViewerProfile) {
  if (viewer.role !== 'student' || !viewer.teacher_id) {
    throw new Error('학생만 질문게시판을 볼 수 있습니다.');
  }

  const service = createServiceClient();
  const className = normalizeClassName(viewer.class);

  const [bookResult, postsResult] = await Promise.all([
    service.from('books').select('id, title').eq('id', bookId).maybeSingle(),
    service
      .from('question_posts')
      .select('id, book_id, student_id, teacher_id, class_name, chat_log_id, question_type, question_text, adopted_answer_id, created_at, updated_at')
      .eq('book_id', bookId)
      .eq('teacher_id', viewer.teacher_id)
      .eq('class_name', className)
      .order('updated_at', { ascending: false }),
  ]);

  if (bookResult.error) {
    throw new Error(bookResult.error.message);
  }

  if (postsResult.error) {
    throw new Error(postsResult.error.message);
  }

  const posts = ((postsResult.data ?? []) as ServiceQuestionPostRow[])
    .map((post) => {
      const questionType = normalizeQuestionType(post.question_type);
      if (!questionType) {
        return null;
      }

      return {
        ...post,
        question_type: questionType,
      };
    })
    .filter((post): post is ServiceQuestionPostRow & { question_type: QuestionBoardCategory } => Boolean(post));
  const postIds = posts.map((post) => post.id);

  const answersResult = postIds.length > 0
    ? await service
      .from('question_answers')
      .select('id, post_id, student_id, answer_text, moderation_status, moderated_by, moderated_at, moderation_reason, created_at, updated_at')
      .in('post_id', postIds)
      .eq('moderation_status', 'visible')
      .order('created_at', { ascending: true })
    : { data: [] as ServiceQuestionAnswerRow[], error: null };

  if (answersResult.error) {
    throw new Error(answersResult.error.message);
  }

  const answers = (answersResult.data ?? []) as ServiceQuestionAnswerRow[];
  const userIds = Array.from(
    new Set([
      ...posts.map((post) => post.student_id),
      ...answers.map((answer) => answer.student_id),
    ])
  );

  const usersResult = userIds.length > 0
    ? await service
      .from('users')
      .select('id, role, teacher_id, class, nickname, avatar, student_code')
      .in('id', userIds)
    : { data: [] as ServiceUserRow[], error: null };

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const userById = new Map(
    ((usersResult.data ?? []) as ServiceUserRow[]).map((row) => [row.id, row] as const)
  );
  const answersByPostId = new Map<string, WorldSmartAnswerItem[]>();

  for (const answer of answers) {
    const items = answersByPostId.get(answer.post_id) ?? [];
    items.push({
      id: answer.id,
      postId: answer.post_id,
      author: toAuthor(userById.get(answer.student_id)),
      content: answer.answer_text,
      createdAt: answer.created_at,
      updatedAt: answer.updated_at,
      isMine: answer.student_id === viewer.id,
      isAdopted: false,
    });
    answersByPostId.set(answer.post_id, items);
  }

  const boardPosts = posts.map((post) => {
    const answerItems = (answersByPostId.get(post.id) ?? []).map((answer) => ({
      ...answer,
      isAdopted: answer.id === post.adopted_answer_id,
    }));

    return {
      id: post.id,
      bookId: post.book_id,
      questionType: post.question_type,
      questionText: post.question_text,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      adoptedAnswerId: post.adopted_answer_id,
      author: toAuthor(userById.get(post.student_id)),
      isMine: post.student_id === viewer.id,
      answers: answerItems,
      myAnswerId: answerItems.find((answer) => answer.isMine)?.id ?? null,
    } satisfies WorldSmartPostItem;
  });

  return {
    bookTitle: (bookResult.data as ServiceBookRow | null)?.title ?? null,
    posts: boardPosts,
  } satisfies WorldSmartBoardData;
}

export async function syncWorldSmartPosts(input: {
  viewer: WorldSmartViewerProfile;
  bookId: string;
  chatLogId?: string | null;
  questions: WorldSmartQuestionPayload;
}) {
  const { viewer, bookId, chatLogId, questions } = input;

  if (viewer.role !== 'student' || !viewer.teacher_id) {
    throw new Error('학생만 질문을 게시할 수 있습니다.');
  }

  const service = createServiceClient();
  const className = normalizeClassName(viewer.class);
  const now = new Date().toISOString();
  const records = (['content', 'character', 'world'] as QuestionBoardCategory[])
    .flatMap((questionType) =>
      uniqStrings(questions[questionType] ?? []).map((questionText) => ({
        book_id: bookId,
        student_id: viewer.id,
        teacher_id: viewer.teacher_id!,
        class_name: className,
        chat_log_id: chatLogId ?? null,
        question_type: questionType,
        question_text: questionText,
        updated_at: now,
      }))
    );

  if (records.length === 0) {
    return { count: 0 };
  }

  const { error } = await service
    .from('question_posts')
    .upsert(records, {
      onConflict: 'student_id,book_id,question_type,question_text',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { count: records.length };
}

export async function upsertWorldSmartAnswer(input: {
  viewer: WorldSmartViewerProfile;
  postId: string;
  content: string;
}) {
  const { viewer, postId, content } = input;

  if (viewer.role !== 'student' || !viewer.teacher_id) {
    throw new Error('학생만 답변을 남길 수 있습니다.');
  }

  const nextContent = content.trim();
  if (!nextContent) {
    throw new Error('답변 내용을 입력해주세요.');
  }

  const service = createServiceClient();
  const className = normalizeClassName(viewer.class);
  const { data: post, error: postError } = await service
    .from('question_posts')
    .select('id, student_id, teacher_id, class_name, adopted_answer_id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    throw new Error('질문을 찾을 수 없습니다.');
  }

  if (post.student_id === viewer.id) {
    throw new Error('내 질문에는 답변을 남길 수 없습니다.');
  }

  if (post.teacher_id !== viewer.teacher_id || post.class_name !== className) {
    throw new Error('같은 반 질문에만 답변할 수 있습니다.');
  }

  if (post.adopted_answer_id) {
    throw new Error('채택이 완료된 질문에는 더 이상 답변할 수 없습니다.');
  }

  const { error } = await service
    .from('question_answers')
    .upsert({
      post_id: postId,
      student_id: viewer.id,
      answer_text: nextContent,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'post_id,student_id',
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateWorldSmartPost(input: {
  viewer: WorldSmartViewerProfile;
  postId: string;
  questionText: string;
}) {
  const { viewer, postId, questionText } = input;

  if (viewer.role !== 'student') {
    throw new Error('학생만 질문을 수정할 수 있습니다.');
  }

  const nextQuestionText = questionText.trim();
  if (!nextQuestionText) {
    throw new Error('질문 내용을 입력해주세요.');
  }

  const service = createServiceClient();
  const { data: post, error: postError } = await service
    .from('question_posts')
    .select('id, student_id, adopted_answer_id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    throw new Error('질문을 찾을 수 없습니다.');
  }

  if (post.student_id !== viewer.id) {
    throw new Error('내가 쓴 질문만 수정할 수 있습니다.');
  }

  if (post.adopted_answer_id) {
    throw new Error('채택이 완료된 질문은 수정할 수 없습니다.');
  }

  const { error } = await service
    .from('question_posts')
    .update({
      question_text: nextQuestionText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) {
    if ('code' in error && error.code === '23505') {
      throw new Error('같은 유형에 같은 질문이 이미 있습니다.');
    }
    throw new Error(error.message);
  }
}

export async function deleteWorldSmartPost(input: {
  viewer: WorldSmartViewerProfile;
  postId: string;
}) {
  const { viewer, postId } = input;

  if (viewer.role !== 'student') {
    throw new Error('학생만 질문을 삭제할 수 있습니다.');
  }

  const service = createServiceClient();
  const { data: post, error: postError } = await service
    .from('question_posts')
    .select('id, student_id, adopted_answer_id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    throw new Error('질문을 찾을 수 없습니다.');
  }

  if (post.student_id !== viewer.id) {
    throw new Error('내가 쓴 질문만 삭제할 수 있습니다.');
  }

  if (post.adopted_answer_id) {
    throw new Error('채택이 완료된 질문은 삭제할 수 없습니다.');
  }

  const { error } = await service
    .from('question_posts')
    .delete()
    .eq('id', postId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function adoptWorldSmartAnswer(input: {
  viewer: WorldSmartViewerProfile;
  postId: string;
  answerId: string;
}) {
  const { viewer, postId, answerId } = input;

  if (viewer.role !== 'student') {
    throw new Error('학생만 답변을 채택할 수 있습니다.');
  }

  const service = createServiceClient();
  const { data: post, error: postError } = await service
    .from('question_posts')
    .select('id, student_id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    throw new Error('질문을 찾을 수 없습니다.');
  }

  if (post.student_id !== viewer.id) {
    throw new Error('내가 쓴 질문에서만 채택할 수 있습니다.');
  }

  const { data: answer, error: answerError } = await service
    .from('question_answers')
    .select('id, post_id')
    .eq('id', answerId)
    .maybeSingle();

  if (answerError) {
    throw new Error(answerError.message);
  }

  if (!answer || answer.post_id !== postId) {
    throw new Error('해당 질문의 답변만 채택할 수 있습니다.');
  }

  const { error } = await service
    .from('question_posts')
    .update({
      adopted_answer_id: answerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getWorldSmartManagementData(
  viewer: WorldSmartViewerProfile,
  filters: WorldSmartManagementFilters = {},
) {
  if (viewer.role !== 'teacher' && viewer.role !== 'admin') {
    throw new Error('질문 게시판 관리 권한이 없습니다.');
  }

  const service = createServiceClient();
  let postsQuery = service
    .from('question_posts')
    .select('id, book_id, student_id, teacher_id, class_name, chat_log_id, question_type, question_text, adopted_answer_id, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (viewer.role === 'teacher') {
    postsQuery = postsQuery.eq('teacher_id', viewer.id);
  } else if (filters.teacherId?.trim()) {
    postsQuery = postsQuery.eq('teacher_id', filters.teacherId.trim());
  }

  if (filters.bookId?.trim()) {
    postsQuery = postsQuery.eq('book_id', filters.bookId.trim());
  }

  if (filters.className?.trim() && filters.className !== 'all') {
    postsQuery = postsQuery.eq('class_name', normalizeClassName(filters.className));
  }

  const normalizedQuestionType = normalizeQuestionType(filters.questionType ?? '');
  if (normalizedQuestionType) {
    postsQuery = postsQuery.eq('question_type', normalizedQuestionType);
  }

  const postsResult = await postsQuery;
  if (postsResult.error) {
    throw new Error(postsResult.error.message);
  }

  const posts = ((postsResult.data ?? []) as ServiceQuestionPostRow[])
    .map((post) => {
      const questionType = normalizeQuestionType(post.question_type);
      if (!questionType) {
        return null;
      }

      return {
        ...post,
        question_type: questionType,
      };
    })
    .filter((post): post is ServiceQuestionPostRow & { question_type: QuestionBoardCategory } => Boolean(post));

  const postIds = posts.map((post) => post.id);
  const bookIds = Array.from(new Set(posts.map((post) => post.book_id)));

  const [answersResult, usersResult, booksResult] = await Promise.all([
    postIds.length > 0
      ? service
        .from('question_answers')
        .select('id, post_id, student_id, answer_text, moderation_status, moderated_by, moderated_at, moderation_reason, created_at, updated_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as ServiceQuestionAnswerRow[], error: null }),
    posts.length > 0
      ? service
        .from('users')
        .select('id, role, teacher_id, class, nickname, avatar, student_code')
        .in('id', Array.from(new Set([
          ...posts.map((post) => post.student_id),
          ...posts.map((post) => post.teacher_id),
        ])))
      : Promise.resolve({ data: [] as ServiceUserRow[], error: null }),
    bookIds.length > 0
      ? service
        .from('books')
        .select('id, title, country_id, cover_url')
        .in('id', bookIds)
      : Promise.resolve({ data: [] as ServiceBookRow[], error: null }),
  ]);

  if (answersResult.error) {
    throw new Error(answersResult.error.message);
  }

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  if (booksResult.error) {
    throw new Error(booksResult.error.message);
  }

  const answers = (answersResult.data ?? []) as ServiceQuestionAnswerRow[];
  const userIds = Array.from(new Set([
    ...((usersResult.data ?? []) as ServiceUserRow[]).map((row) => row.id),
    ...answers.map((answer) => answer.student_id),
    ...answers.map((answer) => answer.moderated_by).filter((id): id is string => Boolean(id)),
  ]));

  const fullUsersResult = userIds.length > 0
    ? await service
      .from('users')
      .select('id, role, teacher_id, class, nickname, avatar, student_code')
      .in('id', userIds)
    : { data: [] as ServiceUserRow[], error: null };

  if (fullUsersResult.error) {
    throw new Error(fullUsersResult.error.message);
  }

  const userById = new Map(
    ((fullUsersResult.data ?? []) as ServiceUserRow[]).map((row) => [row.id, row] as const)
  );
  const bookById = new Map(
    ((booksResult.data ?? []) as ServiceBookRow[]).map((book) => [book.id, book] as const)
  );
  const answersByPostId = new Map<string, WorldSmartManagedAnswerItem[]>();

  for (const answer of answers) {
    const items = answersByPostId.get(answer.post_id) ?? [];
    const moderatedBy = answer.moderated_by ? userById.get(answer.moderated_by) : undefined;

    items.push({
      id: answer.id,
      postId: answer.post_id,
      author: toAuthor(userById.get(answer.student_id)),
      content: answer.answer_text,
      createdAt: answer.created_at,
      updatedAt: answer.updated_at,
      isMine: answer.student_id === viewer.id,
      isAdopted: false,
      moderationStatus: normalizeAnswerModerationStatus(answer.moderation_status),
      moderatedAt: answer.moderated_at,
      moderatedBy: moderatedBy ? toAuthor(moderatedBy) : null,
      moderationReason: answer.moderation_reason,
    });
    answersByPostId.set(answer.post_id, items);
  }

  const managedPosts = posts.map((post) => {
    const book = bookById.get(post.book_id);
    const answerItems = (answersByPostId.get(post.id) ?? []).map((answer) => ({
      ...answer,
      isAdopted: answer.id === post.adopted_answer_id,
    }));
    const visibleAnswerCount = answerItems.filter((answer) => answer.moderationStatus === 'visible').length;
    const hiddenAnswerCount = answerItems.filter((answer) => answer.moderationStatus === 'hidden').length;

    return {
      id: post.id,
      bookId: post.book_id,
      bookTitle: book?.title ?? null,
      countryId: book?.country_id ?? null,
      teacherId: post.teacher_id,
      teacherName: toAuthor(userById.get(post.teacher_id)).nickname,
      className: post.class_name,
      questionType: post.question_type,
      questionText: post.question_text,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      adoptedAnswerId: post.adopted_answer_id,
      author: toAuthor(userById.get(post.student_id)),
      answers: answerItems,
      visibleAnswerCount,
      hiddenAnswerCount,
    } satisfies WorldSmartManagedPostItem;
  }).filter((post) => {
    if (filters.status === 'waiting' && post.adoptedAnswerId) {
      return false;
    }

    if (filters.status === 'adopted' && !post.adoptedAnswerId) {
      return false;
    }

    if (filters.status === 'hidden' && post.hiddenAnswerCount === 0) {
      return false;
    }

    return includesSearchText([
      post.questionText,
      post.author.nickname,
      post.bookTitle,
      post.className,
      ...post.answers.map((answer) => answer.content),
      ...post.answers.map((answer) => answer.author.nickname),
    ], filters.query);
  });

  const bookSummaryById = new Map<string, WorldSmartManagedBookSummary>();
  for (const post of managedPosts) {
    const book = bookById.get(post.bookId);
    const current = bookSummaryById.get(post.bookId) ?? {
      id: post.bookId,
      title: book?.title ?? post.bookTitle,
      countryId: book?.country_id ?? post.countryId,
      coverUrl: book?.cover_url ?? null,
      questionCount: 0,
      visibleAnswerCount: 0,
      hiddenAnswerCount: 0,
      waitingCount: 0,
      adoptedCount: 0,
    };

    current.questionCount += 1;
    current.visibleAnswerCount += post.visibleAnswerCount;
    current.hiddenAnswerCount += post.hiddenAnswerCount;
    if (post.adoptedAnswerId) {
      current.adoptedCount += 1;
    } else {
      current.waitingCount += 1;
    }
    bookSummaryById.set(post.bookId, current);
  }

  return {
    books: [...bookSummaryById.values()].sort((left, right) =>
      (left.title ?? '').localeCompare(right.title ?? '', 'ko-KR')
    ),
    posts: managedPosts,
  } satisfies WorldSmartManagementData;
}

export async function moderateWorldSmartAnswer(input: {
  viewer: WorldSmartViewerProfile;
  answerId: string;
  action: 'hide' | 'unhide' | 'delete';
  reason?: string | null;
}) {
  const { viewer, answerId, action, reason } = input;

  if (viewer.role !== 'teacher' && viewer.role !== 'admin') {
    throw new Error('댓글 관리 권한이 없습니다.');
  }

  const service = createServiceClient();
  const { data: answer, error: answerError } = await service
    .from('question_answers')
    .select('id, post_id')
    .eq('id', answerId)
    .maybeSingle();

  if (answerError) {
    throw new Error(answerError.message);
  }

  if (!answer) {
    throw new Error('댓글을 찾을 수 없습니다.');
  }

  const { data: post, error: postError } = await service
    .from('question_posts')
    .select('id, teacher_id, adopted_answer_id')
    .eq('id', answer.post_id)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    throw new Error('질문을 찾을 수 없습니다.');
  }

  if (viewer.role === 'teacher' && post.teacher_id !== viewer.id) {
    throw new Error('이 반의 댓글만 관리할 수 있습니다.');
  }

  const now = new Date().toISOString();
  const normalizedReason = reason?.trim() || null;

  if ((action === 'hide' || action === 'delete') && post.adopted_answer_id === answerId) {
    const { error } = await service
      .from('question_posts')
      .update({
        adopted_answer_id: null,
        updated_at: now,
      })
      .eq('id', post.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (action === 'delete') {
    const { error } = await service
      .from('question_answers')
      .delete()
      .eq('id', answerId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await service
      .from('question_answers')
      .update({
        moderation_status: action === 'hide' ? 'hidden' : 'visible',
        moderated_by: viewer.id,
        moderated_at: now,
        moderation_reason: normalizedReason,
        updated_at: now,
      })
      .eq('id', answerId);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { error: logError } = await service
    .from('question_moderation_logs')
    .insert({
      target_type: 'answer',
      target_id: answerId,
      action,
      moderator_id: viewer.id,
      moderator_role: viewer.role,
      reason: normalizedReason,
    });

  if (logError) {
    throw new Error(logError.message);
  }
}

export async function getMyWorldSmartSummary(viewer: WorldSmartViewerProfile) {
  if (viewer.role !== 'student') {
    throw new Error('학생만 마이페이지 질문 내역을 볼 수 있습니다.');
  }

  const service = createServiceClient();
  const [postsResult, answersResult] = await Promise.all([
    service
      .from('question_posts')
      .select('id, book_id, question_type, question_text, adopted_answer_id, created_at')
      .eq('student_id', viewer.id)
      .order('created_at', { ascending: false }),
    service
      .from('question_answers')
      .select('id')
      .eq('student_id', viewer.id),
  ]);

  if (postsResult.error) {
    throw new Error(postsResult.error.message);
  }

  if (answersResult.error) {
    throw new Error(answersResult.error.message);
  }

  const posts = ((postsResult.data ?? []) as Array<{
    id: string;
    book_id: string;
    question_type: string;
    question_text: string;
    adopted_answer_id: string | null;
    created_at: string;
  }>)
    .map((post) => {
      const questionType = normalizeQuestionType(post.question_type);
      if (!questionType) {
        return null;
      }

      return {
        ...post,
        question_type: questionType,
      };
    })
    .filter((post): post is {
      id: string;
      book_id: string;
      question_type: QuestionBoardCategory;
      question_text: string;
      adopted_answer_id: string | null;
      created_at: string;
    } => Boolean(post));
  const answerIds = ((answersResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const bookIds = Array.from(new Set(posts.map((post) => post.book_id)));

  const [booksResult, acceptedCountResult] = await Promise.all([
    bookIds.length > 0
      ? service
        .from('books')
        .select('id, title')
        .in('id', bookIds)
      : Promise.resolve({ data: [] as ServiceBookRow[], error: null }),
    answerIds.length > 0
      ? service
        .from('question_posts')
        .select('id', { count: 'exact', head: true })
        .in('adopted_answer_id', answerIds)
      : Promise.resolve({ count: 0, error: null } as { count: number; error: null }),
  ]);

  if (booksResult.error) {
    throw new Error(booksResult.error.message);
  }

  if (acceptedCountResult.error) {
    throw new Error(acceptedCountResult.error.message);
  }

  const bookTitleById = new Map(
    ((booksResult.data ?? []) as ServiceBookRow[]).map((book) => [book.id, book.title] as const)
  );
  const acceptedAnswerCount = acceptedCountResult.count ?? 0;

  return {
    acceptedAnswerCount,
    badge: getWorldSmartBadge(acceptedAnswerCount),
    myQuestions: posts.map((post) => ({
      id: post.id,
      bookId: post.book_id,
      bookTitle: bookTitleById.get(post.book_id) ?? null,
      questionType: post.question_type,
      questionText: post.question_text,
      adoptedAnswerId: post.adopted_answer_id,
      createdAt: post.created_at,
    })),
  } satisfies MyWorldSmartSummary;
}
