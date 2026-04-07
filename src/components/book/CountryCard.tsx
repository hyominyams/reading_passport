'use client';

import { motion } from 'framer-motion';
import type { Country } from '@/lib/data/countries';

interface CountryCardProps {
  country: Country;
  bookCount: number;
  onClick: () => void;
  isSelected: boolean;
}

export default function CountryCard({
  country,
  bookCount,
  onClick,
  isSelected,
}: CountryCardProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative w-full rounded-2xl overflow-hidden
        transition-all duration-200 text-left
        ${isSelected
          ? 'ring-3 ring-secondary shadow-xl'
          : 'ring-1 ring-border hover:shadow-lg'
        }
      `}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-card via-muted-light to-secondary/10" />

      <div className="relative p-5 flex flex-col items-center gap-2.5">
        {/* Flag */}
        <span className="text-5xl drop-shadow-sm">{country.flag}</span>

        {/* Country name - wooden nameplate style */}
        <div className="bg-gradient-to-b from-primary/15 to-primary/25 rounded-lg px-4 py-1.5 shadow-inner">
          <h3 className="text-base font-heading text-foreground">{country.name}</h3>
        </div>

        {/* Description */}
        <p className="text-xs text-muted">{country.description}</p>

        {/* Book count */}
        <span
          className={`
            inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
            ${bookCount > 0
              ? 'bg-secondary/15 text-secondary-dark'
              : 'bg-muted-light text-muted'
            }
          `}
        >
          {bookCount > 0 ? (
            <>
              <span className="text-sm">📚</span>
              {bookCount}권
            </>
          ) : (
            '준비 중'
          )}
        </span>
      </div>
    </motion.button>
  );
}
