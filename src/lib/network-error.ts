export function isFetchNetworkError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const value = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    __isAuthError?: unknown;
  };
  const name = typeof value.name === 'string' ? value.name : '';
  const message = typeof value.message === 'string' ? value.message : '';

  return (
    name === 'AbortError' ||
    name === 'AuthRetryableFetchError' ||
    value.status === 0 ||
    message === 'Failed to fetch' ||
    message === 'fetch failed' ||
    message === 'Load failed' ||
    message.includes('NetworkError')
  );
}

export function logClientError(message: string, error: unknown) {
  if (isFetchNetworkError(error)) {
    console.warn(`${message} 네트워크 연결을 확인한 뒤 다시 시도합니다.`);
    return;
  }

  console.error(message, error);
}
