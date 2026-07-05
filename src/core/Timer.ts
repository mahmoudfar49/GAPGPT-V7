/**
 * Lightweight timing utilities used across the platform.
 *
 * Future extensions (Commit 6+):
 * - Abortable sleep
 * - Timeout helpers
 * - High-resolution timing
 */
export class Timer {
  /**
   * Suspends asynchronous execution for the specified duration.
   */
  public static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns the current Unix timestamp in milliseconds.
   */
  public static now(): number {
    return Date.now();
  }
}