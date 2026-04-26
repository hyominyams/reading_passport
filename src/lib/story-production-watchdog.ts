import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductionStatus } from '@/types/database';

export const PRODUCTION_WATCHDOG_TIMEOUT_MS = 10 * 60 * 1000;
export const PRODUCTION_WATCHDOG_MESSAGE = '제작 시간이 오래 걸려 다시 시도가 필요해요.';

export type ProductionWatchdogStory = {
  id: string;
  production_status: ProductionStatus;
  production_progress: number;
  production_started_at: string | null;
  production_heartbeat_at: string | null;
  production_error_message: string | null;
};

export function isProductionStale(
  story: ProductionWatchdogStory,
  now = new Date()
) {
  if (story.production_status !== 'processing') {
    return false;
  }

  const lastHeartbeat = story.production_heartbeat_at ?? story.production_started_at;

  if (!lastHeartbeat) {
    return true;
  }

  const heartbeatTime = new Date(lastHeartbeat).getTime();

  if (Number.isNaN(heartbeatTime)) {
    return true;
  }

  return now.getTime() - heartbeatTime > PRODUCTION_WATCHDOG_TIMEOUT_MS;
}

export async function applyProductionWatchdog<T extends ProductionWatchdogStory>(
  supabase: SupabaseClient,
  story: T
): Promise<T> {
  if (!isProductionStale(story)) {
    return story;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('stories')
    .update({
      production_status: 'failed',
      production_heartbeat_at: nowIso,
      production_error_message: PRODUCTION_WATCHDOG_MESSAGE,
    })
    .eq('id', story.id)
    .eq('production_status', 'processing')
    .select('production_status, production_progress, production_started_at, production_heartbeat_at, production_error_message')
    .maybeSingle();

  if (error) {
    console.error('Production watchdog update failed:', error);
    return story;
  }

  return {
    ...story,
    ...(data ?? {}),
  } as T;
}
