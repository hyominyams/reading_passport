'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_nickname?: string;
}

interface CommentBoxProps {
  storyId: string;
}

export default function CommentBox({ storyId }: CommentBoxProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('teacher_comments')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true });

    setComments((data ?? []) as Comment[]);
  }, [storyId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.from('teacher_comments').insert({
      story_id: storyId,
      user_id: user.id,
      content: newComment.trim(),
      user_nickname: profile?.nickname ?? '교사',
    });

    if (!error) {
      setNewComment('');
      fetchComments();
    }
    setSubmitting(false);
  };

  return (
    <div>
      {/* Existing comments */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2">
              <span className="text-xs shrink-0 text-primary font-medium">
                {comment.user_nickname ?? '교사'}
              </span>
              <p className="text-xs text-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="짧은 피드백을 남겨보세요..."
          maxLength={200}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0"
        >
          {submitting ? '...' : '\u2764\uFE0F'}
        </button>
      </form>
    </div>
  );
}
