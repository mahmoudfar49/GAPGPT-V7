import { ToolExecutor } from "../core/ToolExecutor.js";
import { ErrorClassifier } from "../core/ErrorClassifier.js";
import { ITool, Context } from "../types/RuntimeTypes.js";
import {
  IExecutionClock,
  IExecutionObserver,
  ExecutionContext,
  VALID_STATE_TRANSITIONS,
} from "../types/ToolTypes.js";

class MockClock implements IExecutionClock {
  private currentTime: number;
  constructor(startTime: number = 1000000) { this.currentTime = startTime; }
  public now(): number { return this.currentTime; }
  public advance(ms: number): void { this.currentTime += ms; }
}

function createMockContext(taskId: string = "test-task"): Context {
  return {
    task: { id: taskId, kind: "conversation", input: "test input" },
    userId: "test-user",
    messages: [],
    memory: [],
    temporary: {},
    persistent: {},
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    failed++;
  }
}

async function testBasicExecution() {
  console.log("\n[Test 1] Basic execution should work");
  const tool: ITool = {
    name: "basic-tool", description: "basic", kind: "general", canHandle: () => true,
    execute: async () => ({ data: "ok" })
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock());
  const result = await executor.execute(tool, {}, createMockContext());
  assert(result.success === true, "Result should be success");
  assert(result.data !== undefined, "Data should be present");
  assert(result.attempts === 1, `Should have 1 attempt (got ${result.attempts})`);
}

async function testRetryBehavior() {
  console.log("\n[Test 2] Retry should work with idempotent tool");
  let attempts = 0;
  const tool: ITool = {
    name: "retry-tool", description: "retry", kind: "general", canHandle: () => true,
    execute: async () => {
      attempts++;
      if (attempts < 3) throw new Error("Operation timed out");
      return { data: "ok" };
    }
  };
  const executor = new ToolExecutor({ maxRetries: 3, retryDelayMs: 10 }, undefined, undefined, new MockClock());
  executor.registerToolMetadata(tool.name, { version: "1.0.0", idempotent: true });
  const result = await executor.executeWithRetry(tool, {}, createMockContext());
  assert(result.success === true, "Result should be success");
  assert(result.attempts === 3, `Should have 3 attempts (got ${result.attempts})`);
}

async function testAbortBeforeStart() {
  console.log("\n[Test 3] Abort before start should cancel immediately");
  let toolCalls = 0;
  const tool: ITool = {
    name: "abort-before-tool", description: "abort", kind: "general", canHandle: () => true,
    execute: async () => { toolCalls++; return { data: "ok" }; }
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock());
  const controller = new AbortController();
  controller.abort();
  const result = await executor.execute(tool, {}, createMockContext(), controller.signal);
  assert(result.success === false, "Result should be failure");
  assert(result.isAborted === true, "Result should be marked as aborted");
  assert(toolCalls === 0, `Tool should not be called (called ${toolCalls} times)`);
  assert(result.error?.code === "ABORT", `Error code should be ABORT (got ${result.error?.code})`);
}

async function testAbortDuringBackoff() {
  console.log("\n[Test 4] Abort during backoff should cancel next attempt");
  let attempts = 0;
  const tool: ITool = {
    name: "abort-backoff-tool", description: "abort backoff", kind: "general", canHandle: () => true,
    execute: async () => {
      attempts++;
      throw new Error("Operation timed out");
    }
  };
  const executor = new ToolExecutor(
    { maxRetries: 5, retryDelayMs: 10000 },
    undefined, undefined, new MockClock()
  );
  executor.registerToolMetadata(tool.name, { version: "1.0.0", idempotent: true });
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  // FIX: Pass undefined for maxRetries, then signal
  const result = await executor.executeWithRetry(tool, {}, createMockContext(), undefined, controller.signal);
  assert(result.success === false, "Result should be failure");
  assert(result.isAborted === true, "Result should be marked as aborted");
  assert(attempts < 5, `Should not complete all retries (attempts: ${attempts})`);
}

async function testStateTransitions() {
  console.log("\n[Test 5] State transitions should be valid");
  const validTransitions = VALID_STATE_TRANSITIONS;
  assert(validTransitions.QUEUED.includes("STARTING"), "QUEUED -> STARTING should be valid");
  assert(validTransitions.RUNNING.includes("COMPLETED"), "RUNNING -> COMPLETED should be valid");
  assert(validTransitions.RUNNING.includes("FAILED"), "RUNNING -> FAILED should be valid");
  assert(validTransitions.RUNNING.includes("CANCELLING"), "RUNNING -> CANCELLING should be valid");
  assert(validTransitions.COMPLETED.length === 0, "COMPLETED should be terminal");
  assert(validTransitions.FAILED.length === 0, "FAILED should be terminal");
  assert(validTransitions.CANCELLED.length === 0, "CANCELLED should be terminal");
}

async function testSnapshotImmutability() {
  console.log("\n[Test 6] ExecutionSnapshot should be immutable");
  const tool: ITool = {
    name: "snapshot-tool", description: "snapshot", kind: "general", canHandle: () => true,
    execute: async () => ({ data: "ok" })
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock());
  const result = await executor.execute(tool, {}, createMockContext());
  assert(result.metadata !== undefined, "Metadata should be present");
  assert(Object.isFrozen(result), "Result should be frozen");
  assert(Object.isFrozen(result.metadata), "Metadata should be frozen");
}

async function testObserverHooks() {
  console.log("\n[Test 7] All observer hooks should be called");
  const hookCalls: string[] = [];
  const observer: IExecutionObserver = {
    name: "test-observer",
    beforeExecute: async () => { hookCalls.push("beforeExecute"); },
    afterExecute: async () => { hookCalls.push("afterExecute"); },
    beforeRetry: async () => { hookCalls.push("beforeRetry"); },
    afterRetry: async () => { hookCalls.push("afterRetry"); },
    onFailure: async () => { hookCalls.push("onFailure"); },
    onTimeout: async () => { hookCalls.push("onTimeout"); },
    onCancel: async () => { hookCalls.push("onCancel"); },
  };
  let attempts = 0;
  const tool: ITool = {
    name: "observer-tool", description: "observer", kind: "general", canHandle: () => true,
    execute: async () => {
      attempts++;
      if (attempts < 2) throw new Error("Operation timed out");
      return { data: "ok" };
    }
  };
  const executor = new ToolExecutor(
    { maxRetries: 3, retryDelayMs: 10 },
    undefined, undefined, new MockClock(),
    [observer]
  );
  executor.registerToolMetadata(tool.name, { version: "1.0.0", idempotent: true });
  const result = await executor.executeWithRetry(tool, {}, createMockContext());
  assert(result.success === true, "Result should be success");
  assert(hookCalls.includes("beforeExecute"), "beforeExecute should be called");
  assert(hookCalls.includes("afterExecute"), "afterExecute should be called");
  assert(hookCalls.includes("beforeRetry"), "beforeRetry should be called");
  assert(hookCalls.includes("afterRetry"), "afterRetry should be called");
}

async function testHookIsolation() {
  console.log("\n[Test 8] Hook failure should not break execution");
  let toolCalls = 0;
  const tool: ITool = {
    name: "hook-isolation-tool", description: "hook isolation", kind: "general", canHandle: () => true,
    execute: async () => { toolCalls++; return { data: "ok" }; }
  };
  const failingObserver: IExecutionObserver = {
    name: "failing-observer",
    beforeExecute: async () => { throw new Error("Hook exploded!"); },
    afterExecute: async () => { throw new Error("After hook exploded!"); },
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock(), [failingObserver]);
  const result = await executor.execute(tool, {}, createMockContext());
  assert(result.success === true, "Execution should succeed despite hook failure");
  assert(toolCalls === 1, `Tool should be called once (called ${toolCalls} times)`);
}

async function testExecutionMetrics() {
  console.log("\n[Test 9] ExecutionMetrics should be present in result");
  const tool: ITool = {
    name: "metrics-tool", description: "metrics", kind: "general", canHandle: () => true,
    execute: async () => ({ data: "ok" })
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock());
  const result = await executor.execute(tool, {}, createMockContext());
  assert(result.durationMs !== undefined, "durationMs should be present");
  assert(typeof result.durationMs === "number", "durationMs should be a number");
  assert(result.durationMs >= 0, "durationMs should be non-negative");
}

async function testTimeoutBehavior() {
  console.log("\n[Test 10] Timeout should be enforced");
  const tool: ITool = {
    name: "timeout-tool", description: "timeout", kind: "general", canHandle: () => true,
    execute: async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { data: "ok" };
    }
  };
  const executor = new ToolExecutor({ defaultTimeoutMs: 100 }, undefined, undefined, new MockClock());
  const result = await executor.executeWithTimeout(tool, {}, createMockContext(), 100);
  assert(result.success === false, "Result should be failure due to timeout");
  assert(result.error?.code === "TIMEOUT", `Error code should be TIMEOUT (got ${result.error?.code})`);
}

async function testAbortCategoryClassification() {
  console.log("\n[Test 11] ABORT should be classified correctly");
  const classifier = new ErrorClassifier();
  const abortError = new Error("Operation was aborted");
  abortError.name = "AbortError";
  const ctx: ExecutionContext = {
    executionId: "test", taskId: "test", attempt: 0,
    elapsedTimeMs: 0, toolName: "test"
  };
  const classified = classifier.classify(abortError, ctx);
  assert(classified.category === "ABORT", `Category should be ABORT (got ${classified.category})`);
  assert(classified.recoverable === false, "ABORT should be non-retryable");
}

async function testTimeoutVsAbortDistinction() {
  console.log("\n[Test 12] Timeout and Abort should be distinct categories");
  const classifier = new ErrorClassifier();
  const ctx: ExecutionContext = {
    executionId: "test", taskId: "test", attempt: 0,
    elapsedTimeMs: 0, toolName: "test"
  };
  const timeoutError = new Error("Operation timed out");
  const timeoutClassified = classifier.classify(timeoutError, ctx);
  assert(timeoutClassified.category === "TIMEOUT", `Timeout should be TIMEOUT (got ${timeoutClassified.category})`);
  const abortError = new Error("Operation was aborted");
  abortError.name = "AbortError";
  const abortClassified = classifier.classify(abortError, ctx);
  assert(abortClassified.category === "ABORT", `Abort should be ABORT (got ${abortClassified.category})`);
  assert(timeoutClassified.category !== abortClassified.category, "TIMEOUT and ABORT should be different");
}

async function testNonIdempotentNoRetry() {
  console.log("\n[Test 13] Non-idempotent tool should not retry on NETWORK");
  let attempts = 0;
  const tool: ITool = {
    name: "non-idempotent-tool", description: "non-idempotent", kind: "general", canHandle: () => true,
    execute: async () => {
      attempts++;
      const e = new Error("Connection reset");
      (e as any).code = "ECONNRESET";
      throw e;
    }
  };
  const executor = new ToolExecutor({ maxRetries: 3, retryDelayMs: 10 }, undefined, undefined, new MockClock());
  executor.registerToolMetadata(tool.name, { version: "1.0.0", idempotent: false });
  const result = await executor.executeWithRetry(tool, {}, createMockContext());
  assert(result.success === false, "Result should be failure");
  assert(result.attempts === 1, `Should have 1 attempt (got ${result.attempts})`);
}

async function testValidationNoRetry() {
  console.log("\n[Test 14] VALIDATION error should not retry");
  let attempts = 0;
  const tool: ITool = {
    name: "validation-tool", description: "validation", kind: "general", canHandle: () => true,
    execute: async () => { attempts++; throw new Error("Invalid input"); }
  };
  const executor = new ToolExecutor({ maxRetries: 3, retryDelayMs: 10 }, undefined, undefined, new MockClock());
  executor.registerToolMetadata(tool.name, { version: "1.0.0", idempotent: true });
  const result = await executor.executeWithRetry(tool, {}, createMockContext());
  assert(result.success === false, "Result should be failure");
  assert(result.attempts === 1, `Should have 1 attempt (got ${result.attempts})`);
}

async function testOnCancelObserver() {
  console.log("\n[Test 15] onCancel observer should be called on abort");
  // FIX: Use explicit type annotation to avoid TypeScript narrowing issue
  let cancelCalled: boolean = false;
  const observer: IExecutionObserver = {
    name: "cancel-observer",
    onCancel: async () => { cancelCalled = true; },
  };
  const tool: ITool = {
    name: "cancel-observer-tool", description: "cancel", kind: "general", canHandle: () => true,
    execute: async () => ({ data: "ok" })
  };
  const executor = new ToolExecutor({}, undefined, undefined, new MockClock(), [observer]);
  const controller = new AbortController();
  controller.abort();
  const result = await executor.execute(tool, {}, createMockContext(), controller.signal);
  assert(result.isAborted === true, "Result should be aborted");
  assert(cancelCalled, "onCancel should be called");
}

async function runAllTests() {
  console.log("Running Execution Lifecycle Test Matrix v9.0.0 (15 scenarios)...\n");
  console.log("=== Core Functionality ===");
  await testBasicExecution();
  await testRetryBehavior();
  await testNonIdempotentNoRetry();
  await testValidationNoRetry();
  console.log("\n=== AbortSignal ===");
  await testAbortBeforeStart();
  await testAbortDuringBackoff();
  await testOnCancelObserver();
  console.log("\n=== State & Snapshot ===");
  await testStateTransitions();
  await testSnapshotImmutability();
  console.log("\n=== Observers ===");
  await testObserverHooks();
  await testHookIsolation();
  console.log("\n=== Metrics & Timeout ===");
  await testExecutionMetrics();
  await testTimeoutBehavior();
  console.log("\n=== Classification ===");
  await testAbortCategoryClassification();
  await testTimeoutVsAbortDistinction();
  console.log("\n" + "=".repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log("=".repeat(60));
  if (failed === 0) console.log("\nAll 15 tests passed!");
  else console.log(`\n${failed} test(s) failed.`);
}

runAllTests().catch((error) => { console.error("Fatal:", error); process.exit(1); });
