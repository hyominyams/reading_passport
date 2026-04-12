/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { CharacterRef } from '@/types/database';
import { getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';

interface SceneGeneratorProps {
  pages: string[];
  characterRefs: CharacterRef[];
  artStyle: string;
  onComplete: (sceneImages: string[]) => void;
}

export default function SceneGenerator({
  pages,
  characterRefs,
  artStyle,
  onComplete,
}: SceneGeneratorProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [sceneDescriptions, setSceneDescriptions] = useState<string[]>(
    pages.map(() => '')
  );
  const [sceneImages, setSceneImages] = useState<(string | null)[]>(
    pages.map(() => null)
  );
  const [generating, setGenerating] = useState(false);

  const detectCharactersInText = (text: string): CharacterRef[] => {
    return characterRefs.filter((ref) => text.includes(ref.name));
  };

  const generateScene = async () => {
    const desc = sceneDescriptions[currentPage];
    if (!desc.trim()) return;

    setGenerating(true);

    try {
      const matchedChars = detectCharactersInText(pages[currentPage]);

      const styleOption = getIllustrationStyleOption(normalizeIllustrationStyle(artStyle));

      const response = await fetch('/api/story/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${desc}. 선택 스타일: ${styleOption.label}. 스타일 키워드: ${styleOption.promptLabel}.`,
          character_refs: matchedChars,
          style_key: normalizeIllustrationStyle(artStyle),
        }),
      });

      const { image_url } = await response.json();

      const updated = [...sceneImages];
      updated[currentPage] = image_url;
      setSceneImages(updated);
    } catch (err) {
      console.error('Scene generation error:', err);
    }

    setGenerating(false);
  };

  const goToNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const allDone = sceneImages.every((img) => img !== null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">장면 그리기</h2>
          <p className="text-sm text-muted mt-1">
            각 페이지의 장면 이미지를 만들어 보세요
          </p>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2">
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`
                w-8 h-8 rounded-full text-xs font-bold transition-all
                ${
                  idx === currentPage
                    ? 'bg-primary text-white'
                    : sceneImages[idx]
                    ? 'bg-success text-white'
                    : 'bg-muted-light text-muted'
                }
              `}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Current page */}
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-card rounded-2xl border border-border p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-primary">
            {currentPage + 1}페이지
          </span>
          <span className="text-xs text-muted">/ {pages.length}페이지</span>
        </div>

        {/* Student text */}
        <div className="bg-muted-light rounded-xl p-4 mb-6">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {pages[currentPage]}
          </p>
          {detectCharactersInText(pages[currentPage]).length > 0 && (
            <div className="flex gap-2 mt-3">
              {detectCharactersInText(pages[currentPage]).map((char) => (
                <span
                  key={char.name}
                  className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
                >
                  {char.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Scene description input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                장면 설명
              </label>
              <textarea
                value={sceneDescriptions[currentPage]}
                onChange={(e) => {
                  const updated = [...sceneDescriptions];
                  updated[currentPage] = e.target.value;
                  setSceneDescriptions(updated);
                }}
                placeholder="이 페이지의 장면을 설명해 주세요..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:border-primary focus:outline-none text-sm resize-none"
              />
            </div>

            <button
              onClick={generateScene}
              disabled={!sceneDescriptions[currentPage].trim() || generating}
              className="w-full px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating
                ? '생성 중...'
                : sceneImages[currentPage]
                ? '재생성하기'
                : '생성하기'}
            </button>
          </div>

          {/* Right: Image preview */}
          <div className="flex items-center justify-center bg-muted-light rounded-xl border border-border min-h-[250px]">
            {generating ? (
              <LoadingSpinner message="장면 이미지를 만들고 있어요..." />
            ) : sceneImages[currentPage] ? (
              <img
                src={sceneImages[currentPage]!}
                alt={`장면 ${currentPage + 1}`}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <p className="text-sm text-muted text-center px-4">
                장면을 설명한 후<br />
                생성하기 버튼을 눌러주세요
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={goToPrev}
            disabled={currentPage === 0}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground disabled:opacity-30 transition-colors"
          >
            이전 장면
          </button>
          {currentPage < pages.length - 1 ? (
            <button
              onClick={goToNext}
              disabled={!sceneImages[currentPage]}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              다음 장면
            </button>
          ) : (
            <motion.button
              whileHover={{ scale: allDone ? 1.02 : 1 }}
              onClick={() => {
                if (allDone) {
                  onComplete(sceneImages.filter(Boolean) as string[]);
                }
              }}
              disabled={!allDone}
              className={`
                px-6 py-2 rounded-xl text-sm font-bold transition-all
                ${
                  allDone
                    ? 'bg-accent text-white hover:bg-accent-dark'
                    : 'bg-muted-light text-muted cursor-not-allowed'
                }
              `}
            >
              완료
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
