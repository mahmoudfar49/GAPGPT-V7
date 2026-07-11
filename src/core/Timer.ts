// =====================================
// GAPGPT V7 - Timer Utility
// Commit 4.1
// =====================================

export class Timer {
  private constructor() {
    // Prevent instantiation
  }

  public static async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  public static now(): number {
    return Date.now();
  }
}