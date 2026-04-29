import { isFetchNetworkError } from '../network-error';

const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

function getMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const retryingFetch: typeof fetch = async (input, init) => {
  const method = getMethod(input, init);
  const maxAttempts = RETRYABLE_METHODS.has(method) ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;

      if (!isFetchNetworkError(error) || attempt === maxAttempts) {
        throw error;
      }

      await wait(150 * attempt);
    }
  }

  throw lastError;
};
