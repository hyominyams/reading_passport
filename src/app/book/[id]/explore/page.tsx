'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ContentCard from '@/components/chat/ContentCard';
import ContentViewer from '@/components/chat/ContentViewer';
import ExplorationProgress from '@/components/chat/ExplorationProgress';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { resolveUserClassId } from '@/lib/classroom';
import type { HiddenContent, Activity, ContentType } from '@/types/database';

export default function ExplorePage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const { user, profile, loading: authLoading } = useAuth();

  const [contents, setContents] = useState<HiddenContent[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [explorationCompleted, setExplorationCompleted] = useState(false);
  const [showStampAnimation, setShowStampAnimation] = useState(false);

  // Content viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeContent, setActiveContent] = useState<HiddenContent | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch hidden content
      let query = supabase
        .from('hidden_content')
        .select('*')
        .eq('book_id', bookId)
        .eq('approved', true)
        .order('order', { ascending: true });

      const classId = await resolveUserClassId(supabase, profile);

      if (classId) {
        query = supabase
          .from('hidden_content')
          .select('*')
          .eq('book_id', bookId)
          .eq('approved', true)
          .or(`scope.eq.global,class_id.eq.${classId}`)
          .order('order', { ascending: true });
      }

      const { data: contentData } = await query;
      setContents((contentData ?? []) as HiddenContent[]);

      // Fetch student activity
      const { data: activityData } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .single();

      if (activityData) {
        const act = activityData as Activity;
        setExplorationCompleted(act.completed_tabs.includes('hidden'));
      }
    } catch (err) {
      console.error('Error fetching explore data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, bookId, profile, supabase]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  const handleContentClick = (content: HiddenContent) => {
    // Mark as viewed
    setViewedIds((prev) => new Set(prev).add(content.id));

    if (content.type === 'link') {
      // Open external links in new tab
      window.open(content.url, '_blank', 'noopener,noreferrer');
    } else {
      // Open in viewer
      setActiveContent(content);
      setViewerOpen(true);
    }
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setActiveContent(null);
  };

  const handleComplete = async () => {
    if (!user || isCompleting) return;
    setIsCompleting(true);

    try {
      const { data: existing } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .single();

      if (existing) {
        const act = existing as Activity;
        const completedTabs = act.completed_tabs.includes('hidden')
          ? act.completed_tabs
          : [...act.completed_tabs, 'hidden'];
        const stampsEarned = act.stamps_earned.includes('hidden')
          ? act.stamps_earned
          : [...act.stamps_earned, 'hidden'];

        await supabase
          .from('activities')
          .update({ completed_tabs: completedTabs, stamps_earned: stampsEarned })
          .eq('id', act.id);

        setExplorationCompleted(true);
        setShowStampAnimation(true);
        setTimeout(() => setShowStampAnimation(false), 3000);
      }
    } catch (err) {
      console.error('Error completing exploration:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const viewedCount = viewedIds.size;
  const totalCount = contents.length;
  const threshold = totalCount > 0 ? Math.max(3, Math.ceil(totalCount * 0.7)) : 0;
  const canComplete = viewedCount >= threshold && !explorationCompleted;

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="콘텐츠를 불러오는 중..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>🔍</span> 숨겨진 이야기
            </h1>
            <p className="text-sm text-muted mt-1">
              이 책에 관련된 다양한 콘텐츠를 탐험해 보세요
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            &larr; 돌아가기
          </button>
        </div>

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-6">
            <ExplorationProgress
              viewed={viewedCount}
              total={totalCount}
              canComplete={canComplete}
              completed={explorationCompleted}
              onComplete={handleComplete}
              isCompleting={isCompleting}
            />
          </div>
        )}

        {/* Content Grid */}
        {totalCount === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <span className="text-4xl block mb-4">📭</span>
              <p className="text-muted text-sm">
                아직 등록된 콘텐츠가 없어요
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contents.map((content, index) => (
              <motion.div
                key={content.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ContentCard
                  id={content.id}
                  type={content.type}
                  title={content.title}
                  url={content.url}
                  viewed={viewedIds.has(content.id)}
                  onClick={() => handleContentClick(content)}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Content Viewer Modal */}
        {activeContent && (
          <ContentViewer
            isOpen={viewerOpen}
            onClose={handleCloseViewer}
            type={activeContent.type as ContentType}
            title={activeContent.title}
            url={activeContent.url}
          />
        )}

        {/* Stamp Animation Overlay */}
        <AnimatePresence>
          {showStampAnimation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="bg-white rounded-3xl p-8 shadow-2xl text-center"
              >
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  탐험 스탬프 획득!
                </h2>
                <p className="text-sm text-muted">
                  숨겨진 이야기를 탐험했어요
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
