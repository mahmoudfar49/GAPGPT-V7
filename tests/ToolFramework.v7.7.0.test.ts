// ============================================================
// FILE: tests/ToolFramework.v7.7.0.test.ts
// VERSION: v7.7.0
// COMMIT: 7 (Tool Framework)
// ============================================================

import { ToolExecutor } from "../src/core/ToolExecutor.js";
import { ToolPipeline } from "../src/core/ToolPipeline.js";
import { ITool, Context, Task } from "../src/types/RuntimeTypes.js";

function createMockContext(): Context {
  return {
    task: { id: "test", kind: "conversation", input: "test" },
    userId: "test-user",
    messages: [],
    memory: [],
    temporary: {},
    persistent: {},
  };
}

async function testEmptyPipeline() {
  console.log("\n[Test 1] EMPTY_PIPELINE...");
  const pipeline = new ToolPipeline();
  const result = await pipeline.execute("input", createMockContext());
  console.log(result.error?.code === "EMPTY_PIPELINE" ? "✅ PASS" : "❌ FAIL");
}

async function testTimeout() {
  console.log("\n[Test 2] Timeout boundary...");
  const slowTool: ITool = {
    name: "slow", description: "slow", kind: "general",
    canHandle: () => true,
    execute: async () => { await new Promise(r => setTimeout(r, 5000)); return {}; }
  };
  const executor = new ToolExecutor({ defaultTimeoutMs: 1000 });
  const result = await executor.executeWithTimeout(slowTool, "input", createMockContext(), 1000);
  console.log(result.error?.code === "TIMEOUT" ? "✅ PASS" : "❌ FAIL");
}

async function testRetry() {
  console.log("\n[Test 3] Retry boundary...");
  let attempts = 0;
  const failTool: ITool = {
    name: "fail", description: "fail", kind: "general",
    canHandle: () => true,
    execute: async () => { attempts++; throw new Error("fail"); }
  };
  const executor = new ToolExecutor({ maxRetries: 3, retryDelayMs: 50 });
  await executor.executeWithRetry(failTool, "input", createMockContext(), 3);
  console.log(attempts === 4 ? "✅ PASS (4 attempts)" : `❌ FAIL (${attempts} attempts)`);
}

async function testImmutability() {
  console.log("\n[Test 4] Immutability...");
  const tool: ITool = { name: "t", description: "t", kind: "general", canHandle: () => true, execute: async () => ({}) };
  const result = await new ToolExecutor().execute(tool, "input", createMockContext());
  console.log(Object.isFrozen(result) && Object.isFrozen(result.metadata!) ? "✅ PASS" : "❌ FAIL");
}

console.log("🧪 Running Tests...");
testEmptyPipeline().then(testTimeout).then(testRetry).then(testImmutability).then(() => console.log("\n✅ Done!"));
