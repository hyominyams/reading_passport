import { createServiceClient } from '@/lib/supabase/service';

type ServiceClient = ReturnType<typeof createServiceClient>;

const readyBuckets = new Map<string, Promise<ServiceClient>>();

export async function ensurePublicBucket(
  bucketName: string,
  fileSizeLimitBytes: number
): Promise<ServiceClient> {
  const existingPromise = readyBuckets.get(bucketName);
  if (existingPromise) {
    return existingPromise;
  }

  const initPromise = (async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (data && !error) {
      return supabase;
    }

    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: fileSizeLimitBytes,
    });

    if (
      createError &&
      !/already exists/i.test(createError.message) &&
      !/duplicate/i.test(createError.message)
    ) {
      throw createError;
    }

    return supabase;
  })();

  readyBuckets.set(bucketName, initPromise);

  try {
    return await initPromise;
  } catch (error) {
    readyBuckets.delete(bucketName);
    throw error;
  }
}
