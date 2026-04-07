'use client';

import { motion } from 'framer-motion';
import type { ContentType } from '@/types/database';

interface ContentCardProps {
  id: string;
  type: ContentType;
  title: string;
  url: string;
  viewed: boolean;
  onClick: () => void;
}

const typeConfig: Record<ContentType, { icon: string; label: string; color: string }> = {
  video: { icon: '📹', label: '영상', color: 'bg-red-50 text-red-600 border-red-200' },
  pdf: { icon: '📄', label: 'PDF', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  image: { icon: '🖼️', label: '이미지', color: 'bg-green-50 text-green-600 border-green-200' },
  link: { icon: '🔗', label: '링크', color: 'bg-purple-50 text-purple-600 border-purple-200' },
};

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  if (match?.[1]) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return null;
}

export default function ContentCard({
  type,
  title,
  url,
  viewed,
  onClick,
}: ContentCardProps) {
  const config = typeConfig[type];
  const ytThumb = type === 'video' ? getYouTubeThumbnail(url) : null;

  return (
    <motion.button
      onClick={onClick}
      className={`w-full bg-card border rounded-xl overflow-hidden text-left transition-all duration-200 hover:shadow-md group ${
        viewed ? 'border-success/40' : 'border-border'
      }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Thumbnail area */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="relative w-full h-36 bg-muted-light flex items-center justify-center overflow-hidden">
        {ytThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ytThumb}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-4xl">{config.icon}</span>
        )}

        {viewed && (
          <div className="absolute top-2 right-2 bg-success text-white text-xs px-2 py-0.5 rounded-full font-medium">
            &#10003; 확인함
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${config.color}`}>
            {config.icon} {config.label}
          </span>
        </div>
        <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
      </div>
    </motion.button>
  );
}
