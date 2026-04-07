/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface ExtractedCharacter {
  name: string;
  description: string;
}

type ArtStyle = 'colored_pencil' | 'watercolor' | 'woodblock' | 'pastel';

interface CharacterDesign {
  name: string;
  description: string;
  appearance: string;
  artStyle: ArtStyle;
  imageUrl: string | null;
  generating: boolean;
}

const artStyles: { value: ArtStyle; label: string; emoji: string }[] = [
  { value: 'colored_pencil', label: '색연필', emoji: '🖍️' },
  { value: 'watercolor', label: '수채화', emoji: '🎨' },
  { value: 'woodblock', label: '판화', emoji: '🪵' },
  { value: 'pastel', label: '파스텔', emoji: '🌸' },
];

interface CharacterDesignerProps {
  extractedCharacters: ExtractedCharacter[];
  storyContext: string;
  onComplete: (characters: { name: string; imageUrl: string }[], artStyle: string) => void;
}

export default function CharacterDesigner({
  extractedCharacters,
  storyContext,
  onComplete,
}: CharacterDesignerProps) {
  const [designs, setDesigns] = useState<CharacterDesign[]>(
    extractedCharacters.map((c) => ({
      name: c.name,
      description: c.description,
      appearance: '',
      artStyle: 'colored_pencil',
      imageUrl: null,
      generating: false,
    }))
  );

  const updateDesign = (index: number, updates: Partial<CharacterDesign>) => {
    setDesigns((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const generateImage = async (index: number) => {
    const design = designs[index];
    if (!design.appearance.trim()) return;

    updateDesign(index, { generating: true, imageUrl: null });

    try {
      // First, enhance the prompt
      const enhanceRes = await fetch('/api/story/enhance-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: design.name,
          appearance_description: design.appearance,
          art_style: design.artStyle,
          story_context: storyContext,
        }),
      });
      const { enhanced_prompt } = await enhanceRes.json();

      // Then generate image
      const imageRes = await fetch('/api/story/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enhanced_prompt,
        }),
      });
      const { image_url } = await imageRes.json();

      updateDesign(index, { imageUrl: image_url, generating: false });
    } catch (err) {
      console.error('Image generation error:', err);
      updateDesign(index, { generating: false });
    }
  };

  const allDone = designs.every((d) => d.imageUrl);

  const handleComplete = () => {
    const characterRefs = designs
      .filter((d) => d.imageUrl)
      .map((d) => ({ name: d.name, imageUrl: d.imageUrl! }));
    // Pass the art style from the first character (all characters share the same art style selection)
    const selectedArtStyle = designs[0]?.artStyle ?? 'colored_pencil';
    onComplete(characterRefs, selectedArtStyle);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">캐릭터 디자인</h2>
        <p className="text-sm text-muted mt-2">
          이야기 속 주요 캐릭터의 모습을 만들어 보세요
        </p>
      </div>

      <div className="space-y-8">
        {designs.map((design, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            className="bg-card rounded-2xl border border-border p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {index + 1}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-foreground">{design.name}</h3>
                <p className="text-xs text-muted">{design.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left: Input controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    외모 설명
                  </label>
                  <textarea
                    value={design.appearance}
                    onChange={(e) =>
                      updateDesign(index, { appearance: e.target.value })
                    }
                    placeholder="예: 갈색 피부, 긴 머리, 전통 옷 입은 소녀"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white focus:border-primary focus:outline-none text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    그림체 선택
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {artStyles.map((style) => (
                      <button
                        key={style.value}
                        onClick={() =>
                          updateDesign(index, { artStyle: style.value })
                        }
                        className={`
                          px-3 py-2 rounded-lg border text-sm font-medium transition-all
                          ${
                            design.artStyle === style.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border bg-white text-muted hover:border-primary/40'
                          }
                        `}
                      >
                        {style.emoji} {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => generateImage(index)}
                  disabled={!design.appearance.trim() || design.generating}
                  className="w-full px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {design.generating ? '생성 중...' : design.imageUrl ? '재생성하기' : '생성하기'}
                </button>
              </div>

              {/* Right: Image preview */}
              <div className="flex items-center justify-center bg-muted-light rounded-xl border border-border min-h-[250px]">
                {design.generating ? (
                  <LoadingSpinner message="캐릭터 이미지를 만들고 있어요..." />
                ) : design.imageUrl ? (
                  <img
                    src={design.imageUrl}
                    alt={design.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <p className="text-sm text-muted text-center px-4">
                    외모를 설명하고 그림체를 선택한 후<br />
                    생성하기 버튼을 눌러주세요
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Complete button */}
      <div className="mt-8 flex justify-center">
        <motion.button
          whileHover={{ scale: allDone ? 1.02 : 1 }}
          whileTap={{ scale: allDone ? 0.98 : 1 }}
          onClick={handleComplete}
          disabled={!allDone}
          className={`
            px-8 py-3 rounded-xl text-base font-bold transition-all
            ${
              allDone
                ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                : 'bg-muted-light text-muted cursor-not-allowed'
            }
          `}
        >
          {allDone ? '다음 단계로' : '모든 캐릭터의 이미지를 생성해 주세요'}
        </motion.button>
      </div>
    </div>
  );
}
