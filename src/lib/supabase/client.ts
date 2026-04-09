import { createBrowserClient } from '@supabase/ssr';

// Persist client across HMR to avoid navigator.locks deadlock.
// Supabase auth acquires a navigator lock; if the client is destroyed
// while holding it (e.g. during HMR), a new client's getSession() hangs.
const GLOBAL_KEY = '__supabase_browser_client';

export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY] as ReturnType<typeof createBrowserClient>;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        // Bypass navigator.locks to prevent deadlock on HMR / Fast Refresh
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
      },
    }
  );

  g[GLOBAL_KEY] = client;
  return client;
}
