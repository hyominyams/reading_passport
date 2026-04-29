import { createBrowserClient } from '@supabase/ssr';
import { retryingFetch } from './fetch';

// Persist client across HMR to avoid navigator.locks deadlock.
// Supabase auth acquires a navigator lock; if the client is destroyed
// while holding it (e.g. during HMR), a new client's getSession() hangs.
const GLOBAL_KEY = '__supabase_browser_client';
type BrowserClient = ReturnType<typeof createBrowserClient>;
type SupabaseBrowserGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: BrowserClient;
};

export function createClient() {
  const g = globalThis as SupabaseBrowserGlobal;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY];

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: retryingFetch,
      },
      auth: {
        flowType: 'pkce',
        // Bypass navigator.locks to prevent deadlock on HMR / Fast Refresh
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
      },
    }
  );

  g[GLOBAL_KEY] = client;
  return client;
}
