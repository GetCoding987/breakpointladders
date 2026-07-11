/**
 * Wraps an async function with retry logic for rate limit errors.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
export async function withRetry(fn, retries = 3, baseDelay = 1000) {
  try {
    return await fn();
  } catch (err) {
    const isRateLimit = err?.message?.includes('Rate limit') || err?.message?.includes('rate limit');
    if (isRateLimit && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw err;
  }
}