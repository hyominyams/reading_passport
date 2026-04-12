'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface StampAnimationProps {
  show: boolean;
  stampLabel: string;
  onComplete: () => void;
}

export default function StampAnimation({
  show,
  stampLabel,
  onComplete,
}: StampAnimationProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
        >
          {/* Ink splatter particles */}
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.8, scale: 0 }}
              animate={{
                opacity: 0,
                scale: 1.5,
                x: Math.cos((i * 36 * Math.PI) / 180) * 100,
                y: Math.sin((i * 36 * Math.PI) / 180) * 100,
              }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="absolute w-2 h-2 rounded-full bg-red-700/50"
            />
          ))}

          {/* Passport stamp */}
          <motion.div
            initial={{ scale: 4, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: -14 }}
            transition={{
              type: 'spring',
              stiffness: 250,
              damping: 18,
              delay: 0.1,
            }}
            className="flex flex-col items-center gap-5"
          >
            {/* Stamp body */}
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(185,28,28,0.3)',
                  '0 0 0 16px rgba(185,28,28,0)',
                ],
              }}
              transition={{ duration: 1, repeat: 2 }}
              className="w-32 h-32 rounded-full border-[4px] border-red-700/80 bg-white/95 flex items-center justify-center relative shadow-xl"
            >
              {/* Inner ring */}
              <div className="absolute inset-[5px] rounded-full border-[2px] border-red-700/50" />
              {/* Stamp text */}
              <div className="flex flex-col items-center z-10">
                <span className="text-red-700/80 text-[9px] font-bold tracking-[0.18em] uppercase leading-none">
                  ★ WORLD DOCENT ★
                </span>
                <span className="text-red-700 text-2xl font-black tracking-[0.1em] uppercase leading-tight mt-1">
                  SUCCESS
                </span>
                <span className="text-red-700/70 text-[8px] font-semibold tracking-[0.25em] uppercase leading-none mt-0.5">
                  APPROVED
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center rotate-[14deg]"
            >
              <p className="text-2xl font-bold text-white mb-1">스탬프 획득!</p>
              <p className="text-base text-red-300 font-medium">
                {stampLabel}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
