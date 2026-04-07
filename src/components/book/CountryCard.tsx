'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import type { Country } from '@/lib/data/countries';

interface CountryCardProps {
  country: Country;
  bookCount: number;
  startedBookCount: number;
  completedBookCount: number;
  onClick: () => void;
  isSelected: boolean;
}

export default function CountryCard({
  country,
  bookCount,
  startedBookCount,
  completedBookCount,
  onClick,
  isSelected,
}: CountryCardProps) {
  const hasBooks = bookCount > 0;
  const progressCount = Math.max(startedBookCount, completedBookCount);
  const progressRatio = hasBooks ? Math.min(1, progressCount / bookCount) : 0;
  const statusLabel = !hasBooks
    ? '준비중'
    : completedBookCount >= bookCount
      ? `완료 ${completedBookCount}/${bookCount}`
      : startedBookCount > 0
        ? `진행 ${startedBookCount}/${bookCount}`
        : '열림';

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`
        group relative w-full aspect-[4/5] rounded-2xl overflow-hidden
        transition-all duration-200 text-left
        ${!hasBooks ? 'opacity-80 grayscale-[0.15]' : ''}
        ${isSelected
          ? 'ring-2 ring-foreground shadow-lg'
          : 'ring-1 ring-border hover:shadow-lg hover:ring-foreground/20'
        }
      `}
    >
      {/* Background image or gradient placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200">
        {country.image_url && (
          <Image
            src={country.image_url}
            alt={country.name}
            fill
            sizes="(max-width: 640px) 50vw, 16vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Book count badge */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <div className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-foreground">
          {bookCount}권
        </div>
        <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white">
          {statusLabel}
        </div>
      </div>

      {/* Content — bottom aligned */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <span className="text-3xl mb-1.5 block drop-shadow-md">{country.flag}</span>
        <h3 className="text-base font-heading font-semibold text-white leading-tight mb-0.5">
          {country.name}
        </h3>
        <p className="text-xs text-white/60">{country.description}</p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/15">
        <div
          className={`h-full ${
            completedBookCount >= bookCount && hasBooks
              ? 'bg-stamp-gold'
              : startedBookCount > 0
                ? 'bg-secondary'
                : 'bg-white/50'
          }`}
          style={{ width: hasBooks ? `${Math.max(4, progressRatio * 100)}%` : '0%' }}
        />
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}
    </motion.button>
  );
}
