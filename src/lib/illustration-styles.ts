import type { IllustrationStyle } from '@/types/database';

export interface IllustrationStyleOption {
  value: IllustrationStyle;
  icon: string;
  label: string;
  description: string;
  promptLabel: string;
  exampleImagePath: string;
}

export const ILLUSTRATION_STYLE_OPTIONS: IllustrationStyleOption[] = [
  {
    value: 'watercolor',
    icon: '🎨',
    label: '수채화',
    description: '맑고 번지는 색감의 투명한 수채화 느낌',
    promptLabel: 'watercolor painting illustration, soft transparent washes, gentle blending',
    exampleImagePath: '/example_image/수채화.png',
  },
  {
    value: 'rough_drawing',
    icon: '🖍️',
    label: '거친 드로잉',
    description: '러프한 선과 스케치감이 살아 있는 드로잉 스타일',
    promptLabel: 'rough sketch drawing, expressive hand-drawn lines, loose rendering',
    exampleImagePath: '/example_image/거친 드로잉.png',
  },
  {
    value: 'pastel',
    icon: '🌸',
    label: '파스텔',
    description: '몽글몽글하고 부드러운 파스텔 톤',
    promptLabel: 'soft pastel illustration, chalky texture, dreamy soft edges',
    exampleImagePath: '/example_image/파스텔.png',
  },
  {
    value: 'collage',
    icon: '🧩',
    label: '콜라주',
    description: '종이를 오려 붙인 듯한 콜라주 스타일',
    promptLabel: 'paper collage illustration, layered cut-paper shapes, tactile handmade look',
    exampleImagePath: '/example_image/콜라쥬.png',
  },
  {
    value: 'woodblock',
    icon: '🪵',
    label: '판화',
    description: '강한 윤곽선과 평면적인 색 대비가 있는 판화 느낌',
    promptLabel: 'woodblock print illustration, bold outlines, carved texture, flat color blocks',
    exampleImagePath: '/example_image/판화.png',
  },
  {
    value: 'cartoon_comic',
    icon: '💬',
    label: '카툰앤코믹',
    description: '만화처럼 또렷하고 경쾌한 카툰 스타일',
    promptLabel: 'cartoon comic illustration, clean outlines, lively stylization',
    exampleImagePath: '/example_image/카툰앤코믹.png',
  },
  {
    value: 'anime',
    icon: '✨',
    label: '일본 애니메이션',
    description: '애니메이션풍의 또렷한 형태와 색감',
    promptLabel: 'Japanese animation inspired illustration, clean cel-shaded anime aesthetic',
    exampleImagePath: '/example_image/일본 애니메이션.png',
  },
  {
    value: 'caricature',
    icon: '🖼️',
    label: '캐리커처',
    description: '과장된 비율과 특징이 살아 있는 캐리커처 스타일',
    promptLabel: 'caricature illustration, exaggerated proportions, expressive stylized features',
    exampleImagePath: '/example_image/캐리커처.png',
  },
  {
    value: 'stop_motion',
    icon: '🎞️',
    label: '스톱모션 미니어처',
    description: '수작업 미니어처처럼 보이는 스톱모션 질감',
    promptLabel: 'stop-motion miniature aesthetic, handcrafted materials, tactile miniature look',
    exampleImagePath: '/example_image/스톱모션_미니어처.png',
  },
  {
    value: 'three_d_clay',
    icon: '🪩',
    label: '3D 클레이아트',
    description: '말랑한 점토 질감이 느껴지는 3D 클레이 스타일',
    promptLabel: '3D clay art style, soft clay texture, sculpted handmade forms',
    exampleImagePath: '/example_image/3D_클레이아트.png',
  },
  {
    value: 'three_d_animation',
    icon: '🧸',
    label: '3D 애니메이션',
    description: '입체감 있는 3D 애니메이션 스타일',
    promptLabel: 'stylized 3D animation look, smooth dimensional forms, polished lighting',
    exampleImagePath: '/example_image/3DAnimation.png',
  },
  {
    value: 'three_d_chibi',
    icon: '🪆',
    label: '3D 치비캐릭터',
    description: '작고 귀여운 비율의 3D 치비 스타일',
    promptLabel: 'stylized 3D chibi character design, cute proportions, toy-like finish',
    exampleImagePath: '/example_image/3D치비캐릭터.png',
  },
];

export const ILLUSTRATION_STYLE_MAP = Object.fromEntries(
  ILLUSTRATION_STYLE_OPTIONS.map((option) => [option.value, option])
) as Record<IllustrationStyle, IllustrationStyleOption>;

export function getIllustrationStyleOption(style: IllustrationStyle) {
  return ILLUSTRATION_STYLE_MAP[style];
}

export function normalizeIllustrationStyle(value: unknown): IllustrationStyle {
  if (typeof value === 'string' && value in ILLUSTRATION_STYLE_MAP) {
    return value as IllustrationStyle;
  }

  return 'watercolor';
}
