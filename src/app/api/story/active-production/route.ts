import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyProductionWatchdog } from '@/lib/story-production-watchdog';
import type { CoverDesign, ProductionStatus } from '@/types/database';

type ActiveProductionRow = {
  id: string;
  book_id: string;
  language: string;
  current_step: number;
  production_status: ProductionStatus;
  production_progress: number;
  production_started_at: string | null;
  production_heartbeat_at: string | null;
  production_error_message: string | null;
  cover_design: CoverDesign | null;
  started_at: string;
};

function buildProductionHref(story: ActiveProductionRow) {
  const suffix =
    story.production_status === 'completed'
      ? '/finish'
      : '/creating';

  return `/book/${story.book_id}/mystory${suffix}?storyId=${story.id}&lang=${story.language}`;
}

export async function GET() {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return Response.json({ activeProduction: null });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('stories')
      .select('id, book_id, language, current_step, production_status, production_progress, production_started_at, production_heartbeat_at, production_error_message, cover_design, started_at')
      .eq('student_id', user.id)
      .eq('story_status', 'draft')
      .gte('current_step', 7)
      .in('production_status', ['processing', 'completed', 'failed'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Active production lookup failed:', error);
      return Response.json({ error: '제작 상태를 불러오지 못했어요.' }, { status: 500 });
    }

    if (!data) {
      return Response.json({ activeProduction: null });
    }

    const story = await applyProductionWatchdog(supabase, data as ActiveProductionRow);

    return Response.json({
      activeProduction: {
        storyId: story.id,
        bookId: story.book_id,
        language: story.language,
        currentStep: story.current_step,
        status: story.production_status,
        progress: story.production_progress,
        errorMessage: story.production_error_message,
        title: story.cover_design?.title?.trim() || '나의 그림책',
        href: buildProductionHref(story),
        startedAt: story.started_at,
      },
    });
  } catch (error) {
    console.error('Active production API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : '제작 상태를 불러오지 못했어요.' },
      { status: 500 }
    );
  }
}
