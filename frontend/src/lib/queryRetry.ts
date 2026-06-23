/**
 * Retry transient failures with exponential backoff (NFR1.6).
 */

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  /** When true, retries on network errors and 5xx/429 responses. */
  enabled?: boolean;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableResponse(res: Response) {
  return RETRYABLE_STATUS.has(res.status);
}

function shouldRetry(method: string) {
  const m = method.toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/**
 * fetch wrapper with exponential backoff for idempotent requests.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 300, enabled = true } = options;
  const method = init?.method ?? 'GET';
  const canRetry = enabled && shouldRetry(method);

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (canRetry && isRetryableResponse(res) && attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (!canRetry || attempt >= maxRetries) break;
      await delay(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}
