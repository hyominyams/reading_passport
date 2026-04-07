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
        relative w-full rounded-2xl overflow-hidden shadow-md
        transition-colors duration-200 text-left
        ${isSelected
          ? 'ring-3 ring-primary shadow-lg'
          : 'ring-1 ring-border hover:shadow-lg'
        }
      `}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />

      <div className="relative p-5 flex flex-col items-center gap-3">
        {/* Flag */}
        <span className="text-5xl">{country.flag}</span>

        {/* Country name */}
        <h3 className="text-lg font-bold text-foreground">{country.name}</h3>

        {/* Description */}
        <p className="text-xs text-muted">{country.description}</p>

        {/* Book count badge */}
        <span
          className={`
            inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
            ${bookCount > 0
              ? 'bg-primary/10 text-primary'
              : 'bg-muted-light text-muted'
            }
          `}
        >
          {bookCount > 0 ? `${bookCount}권의 책` : '준비 중'}
        </span>
      </div>
    </motion.button>
  );
}
