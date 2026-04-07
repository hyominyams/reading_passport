'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
}

interface ConfettiAnimationProps {
  show: boolean;
  duration?: number;
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.8,
  }));
}

export default function ConfettiAnimation({
  show,
  duration = 4000,
}: ConfettiAnimationProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setPieces(generatePieces(60));
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                x: `${piece.x}vw`,
                y: `${piece.y}vh`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: '110vh',
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0.8, 0],
              }}
              transition={{
                duration: 2.5 + Math.random() * 1.5,
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              style={{
                position: 'absolute',
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}

          {/* Center celebration text */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="text-2xl font-bold text-foreground">
                축하해요!
              </h2>
              <p className="text-muted mt-2">나만의 이야기가 완성되었어요!</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
