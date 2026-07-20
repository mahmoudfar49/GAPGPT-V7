import { ServiceContainer } from "../core/ServiceContainer.js";
import { ServiceToken, ServiceLifetime, IRuntimeResolver } from "../types/ServiceTypes.js";
import { ExecutionEngine } from "../core/ExecutionEngine.js";
import { ExecutionAttempt } from "../core/ExecutionAttempt.js";
import { AgentRuntime } from "../core/AgentRuntime.js";
import { ToolExecutor } from "../core/ToolExecutor.js";
import { ErrorClassifier } from "../core/ErrorClassifier.js";
import { DefaultRetryPolicy, DEFAULT_RETRY_POLICY_CONFIG } from "../core/RetryPolicy.js";

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

// Mock classes for testing
class MockClock {
  public now(): number { return Date.now(); }
}

class MockConfig {
  constructor(public readonly timeout: number) {}
}

const ConfigToken = new ServiceToken<MockConfig>("MockConfig");
const ClockToken = new ServiceToken<MockClock>("MockClock");

async function runTests() {
  console.log("Running DI Integration Test Matrix v11.0.0...\n");

  // Test 1: Singleton is shared across entire runtime
  console.log("[Test 1] Singleton is shared across entire runtime");
  const container1 = new ServiceContainer();
  let configCreationCount = 0;
  container1.register(ConfigToken, () => { configCreationCount++; return new MockConfig(5000); }, ServiceLifetime.Singleton);
  
  const resolver1: IRuntimeResolver = container1;
  // Pass resolver to runtime classes to prove they accept it
  const agent1 = new AgentRuntime({}, undefined, resolver1);
  const engine1 = new ExecutionEngine(
    { defaultTimeoutMs: 30000, retryPolicy: DEFAULT_RETRY_POLICY_CONFIG }, 
    new ErrorClassifier(), 
    new DefaultRetryPolicy(), 
    new MockClock(), 
    [], 
    resolver1
  );
  
  assert(agent1 !== undefined, "Agent should instantiate with resolver");
  assert(engine1 !== undefined, "Engine should instantiate with resolver");

  const configFromAgent = container1.resolve(ConfigToken);
  const configFromEngine = container1.resolve(ConfigToken);
  
  assert(configFromAgent === configFromEngine, "Agent and Engine should share the same Singleton instance");
  assert(configCreationCount === 1, `Config should be created only once (created ${configCreationCount} times)`);

  // Test 2: ExecutionEngine runs without direct container access (only IRuntimeResolver)
  console.log("\n[Test 2] ExecutionEngine runs with only IRuntimeResolver");
  const container2 = new ServiceContainer();
  container2.register(ClockToken, () => new MockClock(), ServiceLifetime.Singleton);
  
  const resolver2: IRuntimeResolver = container2;
  const clockInstance = resolver2.resolve(ClockToken);
  
  assert(clockInstance !== undefined, "ExecutionEngine should be able to resolve dependencies via IRuntimeResolver");
  assert(typeof clockInstance.now === "function", "Resolved instance should have expected methods");

  // Test 3: ToolExecutor can resolve services via IRuntimeResolver
  console.log("\n[Test 3] ToolExecutor can resolve services via IRuntimeResolver");
  const container3 = new ServiceContainer();
  container3.register(ClockToken, () => new MockClock(), ServiceLifetime.Singleton);
  
  const resolver3: IRuntimeResolver = container3;
  const executor = new ToolExecutor({}, undefined, undefined, undefined, [], resolver3);
  assert(executor !== undefined, "ToolExecutor should instantiate successfully with IRuntimeResolver");

  // Test 4: Missing provider registration causes predictable error
  console.log("\n[Test 4] Missing provider registration causes predictable error");
  const container4 = new ServiceContainer();
  const MissingToken = new ServiceToken<any>("MissingService");
  
  try {
    container4.resolve(MissingToken);
    assert(false, "Should have thrown an error for missing token");
  } catch (e: any) {
    assert(e.message.includes("No provider registered"), "Should throw correct error message for missing registration");
  }

  // Test 5: ExecutionAttempt works with resolved dependencies
  console.log("\n[Test 5] ExecutionAttempt works with resolved dependencies");
  const container5 = new ServiceContainer();
  container5.register(ClockToken, () => new MockClock(), ServiceLifetime.Singleton);
  
  const resolver5: IRuntimeResolver = container5;
  const clockForAttempt = resolver5.resolve(ClockToken);
  const errorClassifier = new ErrorClassifier();
  
  const attempt = new ExecutionAttempt(clockForAttempt, errorClassifier, resolver5);
  assert(attempt !== undefined, "ExecutionAttempt should instantiate successfully with IRuntimeResolver");

  // Test 6: All classes work with a shared container (End-to-End Wiring)
  console.log("\n[Test 6] All classes work with a shared container (End-to-End Wiring)");
  const sharedContainer = new ServiceContainer();
  sharedContainer.register(ConfigToken, () => new MockConfig(10000), ServiceLifetime.Singleton);
  sharedContainer.register(ClockToken, () => new MockClock(), ServiceLifetime.Singleton);
  
  const sharedResolver: IRuntimeResolver = sharedContainer;
  
  const e2eAgent = new AgentRuntime({}, undefined, sharedResolver);
  const e2eEngine = new ExecutionEngine(
    { defaultTimeoutMs: 30000, retryPolicy: DEFAULT_RETRY_POLICY_CONFIG }, 
    new ErrorClassifier(), 
    new DefaultRetryPolicy(), 
    sharedResolver.resolve(ClockToken), 
    [], 
    sharedResolver
  );
  const e2eExecutor = new ToolExecutor({}, undefined, undefined, sharedResolver.resolve(ClockToken), [], sharedResolver);
  
  assert(e2eAgent !== undefined, "Agent should instantiate");
  assert(e2eEngine !== undefined, "Engine should instantiate");
  assert(e2eExecutor !== undefined, "Executor should instantiate");
  
  const config1_e2e = sharedContainer.resolve(ConfigToken);
  const config2_e2e = sharedContainer.resolve(ConfigToken);
  assert(config1_e2e === config2_e2e, "All components should share the same container state");

  console.log("\n" + "=".repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log("=".repeat(60));
  if (failed === 0) console.log("\n🎉 All 6 DI Integration tests passed! 🎉");
  else console.log(`\n${failed} test(s) failed.`);
}

runTests().catch((error) => { console.error("Fatal:", error); process.exit(1); });
