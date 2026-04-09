'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story, CoverDesign } from '@/types/database';

type CoverImageMode = 'upload' | 'describe' | 'skip';

const STEP_ROUTES: Record<number, string> = {
  1: '',
  2: '/write',
  3: '/draft',
  4: '/scenes',
  5: '/characters',
  6: '/style',
  7: '/creating',
  8: '/finish',
};

function getStepRedirect(bookId: string, currentStep: number, storyId: string): string {
  const route = STEP_ROUTES[currentStep] ?? '';
  return `/book/${bookId}/mystory${route}?storyId=${storyId}`;
}

export default function StylePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cover design
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverImageMode, setCoverImageMode] = useState<CoverImageMode>('skip');
  const [coverDescription, setCoverDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load story
  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (data) {
        const s = data as Story;
        setStory(s);

        // Guard: if current_step < 6, redirect to appropriate step
        if (s.current_step < 6) {
          router.replace(getStepRedirect(bookId, s.current_step, storyId));
          return;
        }

        // Pre-fill from existing data
        if (s.cover_design) {
          const cd = s.cover_design as CoverDesign;
          if (cd.title) setTitle(cd.title);
          if (cd.author) setAuthor(cd.author);
          if (cd.description) {
            setCoverImageMode('describe');
            setCoverDescription(cd.description);
          }
          if (cd.image_url) {
            setCoverImageMode('upload');
            setUploadedImageUrl(cd.image_url);
            setCoverPreviewUrl(cd.image_url);
          }
        }
      }
      setLoading(false);
    };
    fetchStory();
  }, [storyId, bookId, router]);

  // Auto-fill author from profile nickname
  useEffect(() => {
    if (profile?.nickname && !author) {
      setAuthor(profile.nickname);
    }
  }, [profile, author]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setUploadedImageUrl(null);
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
  };

  // Upload cover image
  const uploadCoverImage = async (): Promise<string | null> => {
    if (!coverFile || !storyId) return uploadedImageUrl;
    if (uploadedImageUrl) return uploadedImageUrl;

    const formData = new FormData();
    formData.append('file', coverFile);
    formData.append('storyId', storyId);
    formData.append('type', 'cover');

    const res = await fetch('/api/story/upload-drawing', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '이미지 업로드에 실패했습니다.');
    }

    const { url } = await res.json();
    setUploadedImageUrl(url);
    return url;
  };

  // Save and navigate
  const handleSubmit = async () => {
    if (!storyId || !user || !title.trim()) return;
    setSaving(true);

    try {
      let imageUrl: string | undefined;
      if (coverImageMode === 'upload' && (coverFile || uploadedImageUrl)) {
        const url = await uploadCoverImage();
        if (url) imageUrl = url;
      }

      const coverDesign: CoverDesign = {
        title: title.trim(),
        author: author.trim() || profile?.nickname || '',
      };
      if (coverImageMode === 'upload' && imageUrl) {
        coverDesign.image_url = imageUrl;
      }
      if (coverImageMode === 'describe' && coverDescription.trim()) {
        coverDesign.description = coverDescription.trim();
      }

      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({
          cover_design: coverDesign,
          current_step: 7,
          production_status: 'pending',
        })
        .eq('id', storyId);

      if (error) throw error;

      router.push(`/book/${bookId}/mystory/creating?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setSaving(false);
    }
  };

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="표지를 저장하고 있어요..." />
      </main>
    );
  }

  const isFormValid = title.trim().length > 0;

  return (
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-foreground"
        >
          표지 디자인
        </motion.h1>
        <p className="text-sm text-muted mt-2">
          표지를 꾸며 보세요
        </p>
        <p className="text-xs text-gray-400 mt-1">Step 6/8</p>
      </div>

      {/* Cover Design */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          표지 디자인
        </h2>

        {/* Title */}
        <div className="mb-4">
          <label
            htmlFor="cover-title"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            제목 <span className="text-error">*</span>
          </label>
          <input
            id="cover-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="나만의 이야기 제목을 입력하세요"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            maxLength={50}
          />
        </div>

        {/* Author */}
        <div className="mb-6">
          <label
            htmlFor="cover-author"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            글쓴이
          </label>
          <input
            id="cover-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="글쓴이 이름"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            maxLength={30}
          />
        </div>

        {/* Cover Image */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3">
            표지 이미지
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                { mode: 'upload' as CoverImageMode, label: '직접 그린 그림 올리기' },
                { mode: 'describe' as CoverImageMode, label: '표지 장면 설명하기' },
                { mode: 'skip' as CoverImageMode, label: '건너뛰기 (자동 생성)' },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => {
                  setCoverImageMode(mode);
                  if (mode !== 'upload') {
                    setCoverFile(null);
                    if (coverPreviewUrl?.startsWith('blob:')) {
                      URL.revokeObjectURL(coverPreviewUrl);
                    }
                    setCoverPreviewUrl(uploadedImageUrl);
                  }
                }}
                className={`
                  px-3.5 py-2 rounded-lg text-xs font-medium transition-all border
                  ${
                    coverImageMode === mode
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-card text-muted border-border hover:border-muted hover:text-foreground'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Upload mode */}
          {coverImageMode === 'upload' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {coverPreviewUrl ? (
                <div className="relative">
                  <img
                    src={coverPreviewUrl}
                    alt="표지 미리보기"
                    className="w-full max-h-64 object-contain rounded-xl border border-border"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs text-secondary hover:text-secondary-dark font-medium transition-colors"
                  >
                    다른 이미지로 변경
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 border-2 border-dashed border-border rounded-xl text-muted hover:border-secondary hover:text-secondary transition-all flex flex-col items-center gap-2"
                >
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    이미지를 선택하세요
                  </span>
                </button>
              )}
            </motion.div>
          )}

          {/* Describe mode */}
          {coverImageMode === 'describe' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <textarea
                value={coverDescription}
                onChange={(e) => setCoverDescription(e.target.value)}
                placeholder="표지에 어떤 장면을 그리고 싶은지 설명해 주세요. 예: 주인공이 숲속에서 동물 친구들과 함께 웃고 있는 장면"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all resize-none"
                maxLength={300}
              />
              <p className="text-right text-xs text-muted mt-1">
                {coverDescription.length}/300
              </p>
            </motion.div>
          )}

          {/* Skip mode */}
          {coverImageMode === 'skip' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted bg-muted-light rounded-xl px-4 py-3"
            >
              표지 이미지는 이야기 내용을 바탕으로 자동 생성됩니다.
            </motion.p>
          )}
        </div>
      </motion.section>

      {/* Submit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center pb-8"
      >
        <motion.button
          whileHover={{ scale: isFormValid ? 1.02 : 1 }}
          whileTap={{ scale: isFormValid ? 0.98 : 1 }}
          onClick={handleSubmit}
          disabled={!isFormValid || saving}
          className={`
            px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-lg
            ${
              isFormValid
                ? 'bg-accent text-white hover:bg-accent-dark shadow-accent/20 cursor-pointer'
                : 'bg-border text-muted cursor-not-allowed shadow-none'
            }
          `}
        >
          제작하기!
        </motion.button>
      </motion.div>
    </main>
  );
}
