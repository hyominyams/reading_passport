'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Story, User, Book } from '@/types/database';
import CommentBox from './CommentBox';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface StoryWithDetails extends Story {
  student?: User;
  book?: Book;
}

export default function GalleryGrid() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<StoryWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchStories() {
      if (!user) return;
      const supabase = createClient();

      // Get students for this teacher
      const { data: studentData } = await supabase
        .from('users')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('role', 'student');

      if (!studentData || studentData.length === 0) {
        setLoading(false);
        return;
      }

      const studentIds = studentData.map((s) => s.id);

      const { data } = await supabase
        .from('stories')
        .select('*, student:users(*), book:books(*)')
        .in('student_id', studentIds)
        .not('final_text', 'is', null)
        .order('created_at', { ascending: false });

      setStories((data ?? []) as StoryWithDetails[]);
      setLoading(false);
    }

    fetchStories();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="갤러리를 불러오는 중..." />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        아직 완성된 작품이 없습니다
      </div>
    );
  }

  // Story viewer modal
  if (selectedStory) {
    const pages = selectedStory.final_text ?? [];
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
          {/* Modal header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="font-bold">
                {selectedStory.student?.nickname ?? '학생'}의 이야기
              </h3>
              <p className="text-sm text-muted">
                {selectedStory.book?.title ?? ''}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStory(null);
                setCurrentPage(0);
              }}
              className="text-muted hover:text-foreground text-xl"
            >
              \u00D7
            </button>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-6">
            {pages.length > 0 ? (
              <>
                {/* Scene image if available */}
                {selectedStory.scene_images?.[currentPage] && (
                  <div className="mb-4 rounded-xl overflow-hidden bg-muted-light">
                    <img
                      src={selectedStory.scene_images[currentPage]}
                      alt={`장면 ${currentPage + 1}`}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {pages[currentPage]}
                </p>
              </>
            ) : (
              <p className="text-muted text-center py-8">내용이 없습니다</p>
            )}
          </div>

          {/* Page navigation */}
          {pages.length > 1 && (
            <div className="flex items-center justify-center gap-4 p-3 border-t border-border">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted-light"
              >
                \u2190 이전
              </button>
              <span className="text-sm text-muted">
                {currentPage + 1} / {pages.length}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                disabled={currentPage === pages.length - 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted-light"
              >
                다음 \u2192
              </button>
            </div>
          )}

          {/* Comment box */}
          <div className="p-4 border-t border-border">
            <CommentBox storyId={selectedStory.id} />
          </div>
        </div>
      </div>
    );
  }

  // Masonry grid
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
      {stories.map((story) => (
        <div
          key={story.id}
          onClick={() => setSelectedStory(story)}
          className="break-inside-avoid mb-4 cursor-pointer group"
        >
          <div className="relative rounded-xl overflow-hidden border border-border hover:shadow-lg transition-shadow">
            {/* Cover / placeholder */}
            {story.scene_images?.[0] ? (
              <img
                src={story.scene_images[0]}
                alt={`${story.student?.nickname}의 작품`}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-3xl">\uD83D\uDCDA</span>
              </div>
            )}

            {/* Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <p className="text-white text-sm font-medium">
                {story.student?.nickname ?? '학생'}
              </p>
              <p className="text-white/70 text-xs">
                {story.book?.title ?? ''}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
