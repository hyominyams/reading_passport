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
          {/* Particles / burst effect */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, scale: 0 }}
              animate={{
                opacity: 0,
                scale: 2,
                x: Math.cos((i * 30 * Math.PI) / 180) * 120,
                y: Math.sin((i * 30 * Math.PI) / 180) * 120,
              }}
              transition={{ duration: 1, delay: 0.3 }}
              className="absolute w-3 h-3 rounded-full bg-stamp-gold"
            />
          ))}

          {/* Stamp */}
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(251,191,36,0.4)',
                  '0 0 0 20px rgba(251,191,36,0)',
                ],
              }}
              transition={{ duration: 1, repeat: 2 }}
              className="w-28 h-28 rounded-full bg-stamp-gold flex items-center justify-center shadow-xl"
            >
              <span className="text-5xl">&#9733;</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <p className="text-2xl font-bold text-white mb-1">도장 획득!</p>
              <p className="text-base text-stamp-gold font-medium">
                {stampLabel}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
