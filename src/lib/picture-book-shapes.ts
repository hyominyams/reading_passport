import type { PictureBookShape } from '@/types/database';

export interface PictureBookShapeOption {
  value: PictureBookShape;
  label: string;
  aspectRatio: '4:3' | '3:4' | '1:1';
  promptLabel: string;
}

export const DEFAULT_PICTURE_BOOK_SHAPE: PictureBookShape = 'portrait_3_4';

export const PICTURE_BOOK_SHAPE_OPTIONS: PictureBookShapeOption[] = [
  {
    value: 'landscape_4_3',
    label: '가로형 (4:3)',
    aspectRatio: '4:3',
    promptLabel: 'landscape picture book layout, wide 4:3 composition',
  },
  {
    value: 'portrait_3_4',
    label: '세로형 (3:4)',
    aspectRatio: '3:4',
    promptLabel: 'portrait picture book layout, vertical 3:4 composition',
  },
  {
    value: 'square_1_1',
    label: '정사각형 (1:1)',
    aspectRatio: '1:1',
    promptLabel: 'square picture book layout, balanced 1:1 composition',
  },
];

const PICTURE_BOOK_SHAPE_MAP = Object.fromEntries(
  PICTURE_BOOK_SHAPE_OPTIONS.map((option) => [option.value, option])
) as Record<PictureBookShape, PictureBookShapeOption>;

export function normalizePictureBookShape(value: unknown): PictureBookShape {
  if (typeof value === 'string' && value in PICTURE_BOOK_SHAPE_MAP) {
    return value as PictureBookShape;
  }

  return DEFAULT_PICTURE_BOOK_SHAPE;
}

export function getPictureBookShapeOption(shape: PictureBookShape) {
  return PICTURE_BOOK_SHAPE_MAP[shape];
}
