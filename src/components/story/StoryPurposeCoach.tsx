'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Heart,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Save,
  Sprout,
  UserRound,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { logClientError } from '@/lib/network-error';
import type { PurposeAnswers } from '@/types/database';

type DisplayMode = 'hidden' | 'modal' | 'sidebar';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PurposeKey = keyof PurposeAnswers;

const EMPTY_ANSWERS: PurposeAnswers = {
  reader: '',
  message: '',
  reason: '',
};

const QUESTION_ITEMS: Array<{
  key: PurposeKey;
  title: string;
  example: string;
  rows: number;
  Icon: typeof UserRound;
  accentClass: string;
}> = [
  {
    key: 'reader',
    title: '누가 내 그림책을 읽으면 좋겠나요?',
    example: '예: 우리 반 친구들 / 동생 / 부모님 / 다른 나라 친구들',
    rows: 1,
    Icon: UserRound,
    accentClass: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  {
    key: 'message',
    title: '어떤 이야기를 전하고 싶나요?',
    example: '예: 탄자니아 친구가 학교에 가지 못하는 이유 / 멀리 있는 친구의 따뜻한 마음',
    rows: 3,
    Icon: MessageCircle,
    accentClass: 'text-sky-700 bg-sky-50 border-sky-100',
  },
  {
    key: 'reason',
    title: '왜 이 이야기를 전하고 싶나요?',
    example: '예: 다른 나라 친구도 우리와 같다는 걸 알려주고 싶어서 / 작은 관심도 큰 도움이 된다는 걸 전하고 싶어서',
    rows: 3,
    Icon: Heart,
    accentClass: 'text-rose-700 bg-rose-50 border-rose-100',
  },
];

function normalizePurposeAnswers(raw: unknown): PurposeAnswers {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ANSWERS };

  const value = raw as Record<string, unknown>;
  return {
    reader: typeof value.reader === 'string' ? value.reader : '',
    message: typeof value.message === 'string' ? value.message : '',
    reason: typeof value.reason === 'string' ? value.reason : '',
  };
}

function hasAnyAnswer(answers: PurposeAnswers) {
  return Object.values(answers).some((value) => value.trim().length > 0);
}

function hasAllAnswers(answers: PurposeAnswers) {
  return Object.values(answers).every((value) => value.trim().length > 0);
}

function serializeAnswers(answers: PurposeAnswers) {
  return JSON.stringify({
    reader: answers.reader.trim(),
    message: answers.message.trim(),
    reason: answers.reason.trim(),
  });
}

interface StoryPurposeCoachProps {
  storyId: string | null;
  autoOpen?: boolean;
}

export default function StoryPurposeCoach({
  storyId,
  autoOpen = false,
}: StoryPurposeCoachProps) {
  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState<PurposeAnswers>({ ...EMPTY_ANSWERS });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('hidden');
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const answersRef = useRef(answers);
  const saveSeqRef = useRef(0);

  const hasAny = useMemo(() => hasAnyAnswer(answers), [answers]);
  const allComplete = useMemo(() => hasAllAnswers(answers), [answers]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let cancelled = false;

    const loadAnswers = async () => {
      setLoaded(false);
      setSaveState('idle');
      setDirty(false);

      if (!storyId) {
        if (!cancelled) {
          setDisplayMode('hidden');
          setLoaded(true);
        }
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('stories')
        .select('purpose_answers')
        .eq('id', storyId)
        .single();

      if (cancelled) return;

      if (error) {
        logClientError('Purpose coach load error:', error);
      }

      const nextAnswers = normalizePurposeAnswers(data?.purpose_answers);
      const hasSavedAnswers = hasAnyAnswer(nextAnswers);

      // Only auto-open once per story: the first time the student arrives
      // at step 3 (right after finishing the Tori chat). After that, stay
      // collapsed on every page so it doesn't keep popping up.
      const seenKey = `mystory:${storyId}:purposeCoachAutoOpened`;
      let alreadySeen = false;
      try {
        alreadySeen = window.localStorage.getItem(seenKey) === '1';
      } catch {
        alreadySeen = false;
      }

      const shouldAutoOpen = autoOpen && !alreadySeen;
      if (shouldAutoOpen) {
        try {
          window.localStorage.setItem(seenKey, '1');
        } catch {
          /* localStorage unavailable — still proceed with auto-open */
        }
      }

      setAnswers(nextAnswers);
      answersRef.current = nextAnswers;
      setEditing(!hasSavedAnswers);
      setCollapsed(!shouldAutoOpen);
      setDisplayMode(shouldAutoOpen && !hasSavedAnswers ? 'modal' : 'sidebar');
      setLoaded(true);
    };

    void loadAnswers();

    return () => {
      cancelled = true;
    };
  }, [autoOpen, storyId]);

  const saveAnswers = useCallback(
    async (nextAnswers: PurposeAnswers) => {
      if (!storyId) return false;

      const saveSeq = saveSeqRef.current + 1;
      saveSeqRef.current = saveSeq;
      setSaveState('saving');

      const payload = hasAnyAnswer(nextAnswers) ? nextAnswers : null;
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({ purpose_answers: payload })
        .eq('id', storyId);

      if (saveSeq !== saveSeqRef.current) {
        return !error;
      }

      if (error) {
        logClientError('Purpose coach save error:', error);
        setSaveState('error');
        return false;
      }

      const savedSnapshot = serializeAnswers(nextAnswers);
      setDirty(serializeAnswers(answersRef.current) !== savedSnapshot);
      setSaveState('saved');
      return true;
    },
    [storyId],
  );

  useEffect(() => {
    if (!loaded || !dirty || !storyId) return;

    const timer = setTimeout(() => {
      void saveAnswers(answers);
    }, 900);

    return () => clearTimeout(timer);
  }, [answers, dirty, loaded, saveAnswers, storyId]);

  useEffect(() => {
    if (displayMode !== 'modal' || !allComplete || dirty || saveState === 'saving' || saveState === 'error') {
      return;
    }

    const timer = setTimeout(() => {
      setEditing(false);
      setCollapsed(false);
      setDisplayMode('sidebar');
    }, 650);

    return () => clearTimeout(timer);
  }, [allComplete, dirty, displayMode, saveState]);

  const updateAnswer = useCallback((key: PurposeKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveState('saving');
  }, []);

  const handleSaveAndPin = useCallback(async () => {
    if (!hasAny) return;

    const ok = await saveAnswers(answers);
    if (!ok) return;

    setEditing(false);
    setCollapsed(false);
    setDisplayMode('sidebar');
  }, [answers, hasAny, saveAnswers]);

  const handleKeepForLater = useCallback(() => {
    setDisplayMode('sidebar');
    setCollapsed(true);
    setEditing(true);
  }, []);

  const openSidebar = useCallback(() => {
    setDisplayMode('sidebar');
    setCollapsed(false);
  }, []);

  if (!loaded || displayMode === 'hidden') {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {displayMode === 'modal' && (
          <PurposeModal
            answers={answers}
            saveState={saveState}
            canSave={hasAny && saveState !== 'saving'}
            onAnswerChange={updateAnswer}
            onSave={() => void handleSaveAndPin()}
            onClose={handleKeepForLater}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {displayMode === 'sidebar' && collapsed ? (
          <CollapsedCoachButton key="purpose-coach-collapsed" onOpen={openSidebar} hasAny={hasAny} />
        ) : displayMode === 'sidebar' ? (
          <PurposeSidebar
            key="purpose-coach-sidebar"
            answers={answers}
            editing={editing}
            saveState={saveState}
            canSave={hasAny && saveState !== 'saving'}
            onAnswerChange={updateAnswer}
            onSave={() => void handleSaveAndPin()}
            onEdit={() => setEditing(true)}
            onCollapse={() => setCollapsed(true)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function PurposeModal({
  answers,
  saveState,
  canSave,
  onAnswerChange,
  onSave,
  onClose,
}: {
  answers: PurposeAnswers;
  saveState: SaveState;
  canSave: boolean;
  onAnswerChange: (key: PurposeKey, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="purpose-coach-title"
        className="relative max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#e8dcc6] bg-[#fffaf0] p-5 shadow-2xl sm:p-6"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.22 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e5d7bf] bg-white text-gray-500 transition-colors hover:bg-[#f7eedf] hover:text-gray-900"
          aria-label="나중에 적기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sprout className="h-3.5 w-3.5" />
            작가의 방향
          </div>
          <h2 id="purpose-coach-title" className="text-2xl font-bold leading-tight text-gray-950">
            🌱 이제 너도 작가가 될 수 있어!
          </h2>
          <div className="mt-3 space-y-1.5 text-sm leading-6 text-gray-700">
            <p>작가가 되기 전, 잠깐 멈춰서 생각해 볼까요?</p>
            <p>좋은 그림책은 누구에게, 무엇을, 왜 전하고 싶은지가 분명한 책이에요.</p>
            <p>아래 세 가지 질문에 답하며 내 그림책의 방향을 정해 봅시다.</p>
            <p>이 답이 그림책을 만드는 동안 나를 도와줄 거예요. 📖</p>
          </div>
        </div>

        <PurposeForm
          answers={answers}
          compact={false}
          onAnswerChange={onAnswerChange}
        />

        <div className="mt-5 flex flex-col gap-3 border-t border-[#eadfc7] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <SaveStatus saveState={saveState} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#e5d7bf] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-[#f7eedf]"
            >
              나중에 적기
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" />
              저장하기
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PurposeSidebar({
  answers,
  editing,
  saveState,
  canSave,
  onAnswerChange,
  onSave,
  onEdit,
  onCollapse,
}: {
  answers: PurposeAnswers;
  editing: boolean;
  saveState: SaveState;
  canSave: boolean;
  onAnswerChange: (key: PurposeKey, value: string) => void;
  onSave: () => void;
  onEdit: () => void;
  onCollapse: () => void;
}) {
  return (
    <motion.aside
      className="fixed top-[5.25rem] left-3 right-3 z-40 max-h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-[#e8dcc6] bg-[#fffaf0] shadow-2xl lg:top-24 lg:left-auto lg:right-4 lg:w-[20rem] lg:max-w-[calc(100vw-2rem)] xl:w-[23rem]"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#eadfc7] px-4 py-4">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Sprout className="h-3.5 w-3.5" />
            작가의 방향
          </div>
          <h2 className="text-base font-bold leading-snug text-gray-950">
            🌱 이제 너도 작가가 될 수 있어!
          </h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5d7bf] bg-white text-gray-500 transition-colors hover:bg-[#f7eedf] hover:text-gray-900"
          aria-label="작가의 방향 접기"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-4 py-4">
        {editing ? (
          <>
            <p className="mb-4 text-sm leading-6 text-gray-700">
              그림책을 만드는 동안 계속 떠올릴 세 가지를 적어 보세요.
            </p>
            <PurposeForm
              answers={answers}
              compact
              onAnswerChange={onAnswerChange}
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <SaveStatus saveState={saveState} />
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Save className="h-4 w-4" />
                저장하기
              </button>
            </div>
          </>
        ) : (
          <>
            <PurposeSummary answers={answers} />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eadfc7] pt-4">
              <SaveStatus saveState={saveState} />
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e5d7bf] bg-white px-4 py-2.5 text-sm font-bold text-gray-800 transition-colors hover:bg-[#f7eedf]"
              >
                <Pencil className="h-4 w-4" />
                수정하기
              </button>
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
}

function CollapsedCoachButton({ onOpen, hasAny }: { onOpen: () => void; hasAny: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="fixed top-[4.5rem] right-3 z-40 inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-[#e8dcc6] bg-[#fffaf0] px-4 py-3 text-sm font-bold text-gray-900 shadow-xl transition-colors hover:bg-[#f7eedf] lg:top-24 lg:right-4"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      aria-label="작가의 방향 열기"
    >
      {hasAny ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
      ) : (
        <BookOpen className="h-4 w-4 text-amber-700" />
      )}
      <span>내 그림책 방향</span>
      <PanelRightOpen className="h-4 w-4 text-gray-500" />
    </motion.button>
  );
}

function PurposeForm({
  answers,
  compact,
  onAnswerChange,
}: {
  answers: PurposeAnswers;
  compact: boolean;
  onAnswerChange: (key: PurposeKey, value: string) => void;
}) {
  return (
    <div className={compact ? 'space-y-3' : 'mt-5 space-y-4'}>
      {QUESTION_ITEMS.map(({ key, title, example, rows, Icon, accentClass }) => {
        const inputId = `purpose-${key}`;
        const sharedClass =
          'w-full rounded-xl border border-[#ddcfb7] bg-white px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10';

        return (
          <div key={key} className="rounded-2xl border border-[#eadfc7] bg-white/65 p-3">
            <label htmlFor={inputId} className="flex items-start gap-2 text-sm font-bold text-gray-950">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${accentClass}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 leading-6">{title}</span>
            </label>
            <p className="mt-2 text-xs leading-5 text-gray-500">{example}</p>
            {rows === 1 ? (
              <input
                id={inputId}
                value={answers[key]}
                onChange={(event) => onAnswerChange(key, event.target.value)}
                maxLength={80}
                className={`${sharedClass} mt-2`}
              />
            ) : (
              <textarea
                id={inputId}
                value={answers[key]}
                onChange={(event) => onAnswerChange(key, event.target.value)}
                rows={compact ? 2 : rows}
                maxLength={220}
                className={`${sharedClass} mt-2 resize-none`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PurposeSummary({ answers }: { answers: PurposeAnswers }) {
  return (
    <div className="space-y-3">
      {QUESTION_ITEMS.map(({ key, title, Icon, accentClass }) => {
        const value = answers[key].trim();

        return (
          <div key={key} className="rounded-2xl border border-[#eadfc7] bg-white/70 p-3">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${accentClass}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-5 text-gray-600">{title}</p>
                <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${value ? 'text-gray-950' : 'text-gray-400'}`}>
                  {value || '아직 적지 않았어요'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SaveStatus({ saveState }: { saveState: SaveState }) {
  if (saveState === 'saving') {
    return <p className="text-xs font-medium text-amber-700">저장 중...</p>;
  }

  if (saveState === 'saved') {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        저장됨
      </p>
    );
  }

  if (saveState === 'error') {
    return <p className="text-xs font-medium text-red-600">저장되지 않았어요</p>;
  }

  return <p className="text-xs font-medium text-gray-500">입력하면 자동 저장돼요</p>;
}
