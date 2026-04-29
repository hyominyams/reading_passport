import { createClient } from '@supabase/supabase-js';
import { retryingFetch } from './fetch';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: retryingFetch,
      },
    }
  );
}
