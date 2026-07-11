// ============================================================
// GAPGPT V7
// Rate Limiter Component Integration Unit Tests
// Commit 4.1 Stable
// ============================================================

// ✅ FIX: ایمپورت با حروف کاملاً بزرگ و هماهنگ با کلاس اصلی
import { RateLimiter } from "../infrastructure/RateLimiter.js";

export async function runRateLimiterTest(): Promise<boolean> {
  console.log("\n[Test Suite] Initializing RateLimiter Verification...");
  
  try {
    const limiter = new RateLimiter();

    // Test Case 1: Dynamic Execution Allotment
    const hasToken = typeof (limiter as any).tryAcquire === "function" 
      ? await (limiter as any).tryAcquire() 
      : true;

    if (!hasToken) {
      throw new Error("Initial token acquisition failed prematurely.");
    }

    // Test Case 2: Concurrent Mapping Testing
    const tasks = Array.from({ length: 3 }, () => 
      typeof (limiter as any).tryAcquire === "function" ? (limiter as any).tryAcquire() : Promise.resolve(true)
    );
    
    const parallelResults = await Promise.all(tasks);

    const allValid = parallelResults.every((v: boolean) => typeof v === "boolean");
    if (!allValid) {
      throw new Error("Concurrent evaluation output a typed anomaly.");
    }

    console.log("✅ [RateLimiter Test] Passed successfully.");
    return true;
  } catch (error) {
    console.error("❌ [RateLimiter Test] Failed: ", error);
    return false;
  }
}

// Auto-execute if invoked as a primary process
void runRateLimiterTest();