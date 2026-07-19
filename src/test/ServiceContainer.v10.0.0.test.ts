import { ServiceContainer } from "../core/ServiceContainer.js";
import { ServiceToken, ServiceLifetime } from "../types/ServiceTypes.js";

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

class MockService {
  constructor(public readonly id: string) {}
}

const TokenA = new ServiceToken<MockService>("ServiceA");
const TokenB = new ServiceToken<MockService>("ServiceB");
const TokenC = new ServiceToken<MockService>("ServiceC");

async function runTests() {
  console.log("Running Service Container Test Matrix v10.0.0 (Final)...\n");

  console.log("=== Core & Hardening Tests ===\n");

  console.log("[Test 1] Singleton Lifetime");
  const container1 = new ServiceContainer();
  let instanceCount1 = 0;
  container1.register(TokenA, () => { instanceCount1++; return new MockService("Singleton"); }, ServiceLifetime.Singleton);
  const res1a = container1.resolve(TokenA);
  const res1b = container1.resolve(TokenA);
  assert(res1a === res1b, "Singleton should return the same instance");
  assert(instanceCount1 === 1, `Factory should be called exactly once (called ${instanceCount1} times)`);

  console.log("\n[Test 2] Transient Lifetime");
  const container2 = new ServiceContainer();
  let instanceCount2 = 0;
  container2.register(TokenA, () => { instanceCount2++; return new MockService("Transient"); }, ServiceLifetime.Transient);
  const res2a = container2.resolve(TokenA);
  const res2b = container2.resolve(TokenA);
  assert(res2a !== res2b, "Transient should return different instances");
  assert(instanceCount2 === 2, `Factory should be called twice (called ${instanceCount2} times)`);

  console.log("\n[Test 3] Scoped Lifetime (Placeholder)");
  const container3 = new ServiceContainer();
  let instanceCount3 = 0;
  container3.register(TokenA, () => { instanceCount3++; return new MockService("Scoped"); }, ServiceLifetime.Scoped);
  const res3a = container3.resolve(TokenA);
  const res3b = container3.resolve(TokenA);
  assert(res3a !== res3b, "Scoped currently behaves like Transient");
  assert(instanceCount3 === 2, `Factory should be called twice for Scoped (called ${instanceCount3} times)`);

  console.log("\n[Test 4] Missing Token Error");
  const container4 = new ServiceContainer();
  try { container4.resolve(TokenA); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("No provider registered"), "Correct error"); }

  console.log("\n[Test 5] Duplicate Registration");
  const container5 = new ServiceContainer();
  container5.register(TokenA, () => new MockService("A"));
  try { container5.register(TokenA, () => new MockService("A2")); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("Duplicate registration"), "Correct error"); }

  console.log("\n[Test 6] Circular Dependency Detection (2-node)");
  const container6 = new ServiceContainer();
  container6.register(TokenA, (c) => c.resolve(TokenB), ServiceLifetime.Singleton);
  container6.register(TokenB, (c) => c.resolve(TokenA), ServiceLifetime.Singleton);
  try { container6.resolve(TokenA); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("Circular dependency detected"), "Correct error"); }

  console.log("\n[Test 7] tryResolve returns undefined");
  const container7 = new ServiceContainer();
  assert(container7.tryResolve(TokenA) === undefined, "tryResolve should return undefined");

  console.log("\n[Test 8] has() method");
  const container8 = new ServiceContainer();
  container8.register(TokenA, () => new MockService("A"));
  assert(container8.has(TokenA) === true, "has() true for registered");
  assert(container8.has(TokenB) === false, "has() false for unregistered");

  console.log("\n[Test 9] createScope() shares registry");
  const container9 = new ServiceContainer();
  container9.register(TokenA, () => new MockService("A"));
  const scope9 = container9.createScope();
  assert(scope9.has(TokenA) === true, "Scope has parent registration");
  assert(scope9.resolve(TokenA) !== undefined, "Scope can resolve parent registration");

  console.log("\n[Test 10] dispose() clears registry");
  const container10 = new ServiceContainer();
  container10.register(TokenA, () => new MockService("A"));
  await container10.dispose();
  assert(container10.has(TokenA) === false, "dispose() clears registrations");

  console.log("\n[Test 11] Singleton shared across child scopes");
  const container11 = new ServiceContainer();
  let factoryCalls11 = 0;
  container11.register(TokenA, () => { factoryCalls11++; return new MockService("Shared"); }, ServiceLifetime.Singleton);
  const child11a = container11.createScope();
  const child11b = container11.createScope();
  const inst11a = child11a.resolve(TokenA);
  const inst11b = child11b.resolve(TokenA);
  const inst11p = container11.resolve(TokenA);
  assert(inst11a === inst11b && inst11a === inst11p, "All share same singleton instance");
  assert(factoryCalls11 === 1, `Factory called once (called ${factoryCalls11})`);

  console.log("\n[Test 12] Deep circular dependency chain (3-node)");
  const container12 = new ServiceContainer();
  container12.register(TokenA, (c) => c.resolve(TokenB), ServiceLifetime.Singleton);
  container12.register(TokenB, (c) => c.resolve(TokenC), ServiceLifetime.Singleton);
  container12.register(TokenC, (c) => c.resolve(TokenA), ServiceLifetime.Singleton);
  try { container12.resolve(TokenA); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("Circular dependency detected"), "Correct error"); }

  console.log("\n[Test 13] Factory failure propagation");
  const container13 = new ServiceContainer();
  let factoryCalls13 = 0;
  container13.register(TokenA, () => { factoryCalls13++; throw new Error("Factory failed"); }, ServiceLifetime.Singleton);
  let err13a: any = null, err13b: any = null;
  try { container13.resolve(TokenA); } catch (e: any) { err13a = e; }
  try { container13.resolve(TokenA); } catch (e: any) { err13b = e; }
  assert(err13a?.message === "Factory failed", "Error preserved");
  assert(err13b !== null, "Second resolve also throws");
  assert(factoryCalls13 === 2, `Factory called twice (no caching of failed instances)`);

  console.log("\n[Test 14] Re-entrant resolution detection");
  const container14 = new ServiceContainer();
  container14.register(TokenA, (c) => c.resolve(TokenA), ServiceLifetime.Singleton);
  try { container14.resolve(TokenA); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("Circular dependency detected"), "Correct error"); }

  console.log("\n[Test 15] Child scope isolation (shared registry behavior)");
  const container15 = new ServiceContainer();
  const child15a = container15.createScope();
  const child15b = container15.createScope();
  child15a.register(TokenB, () => new MockService("ChildLocal"));
  assert(container15.has(TokenB) === true, "Child registration visible to parent (shared)");
  assert(child15b.has(TokenB) === true, "Child registration visible to sibling (shared)");

  console.log("\n[Test 16] Override policy in child scope");
  const container16 = new ServiceContainer();
  container16.register(TokenA, () => new MockService("Parent"), ServiceLifetime.Singleton);
  const child16 = container16.createScope();
  try { child16.register(TokenA, () => new MockService("Child"), ServiceLifetime.Singleton); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("Duplicate registration"), "Child cannot override parent"); }

  console.log("\n[Test 17] Factory with dependencies");
  const container17 = new ServiceContainer();
  container17.register(TokenA, () => new MockService("DepA"), ServiceLifetime.Singleton);
  container17.register(TokenB, (c) => new MockService(`DepB_${(c.resolve(TokenA) as MockService).id}`), ServiceLifetime.Singleton);
  assert(container17.resolve(TokenB).id === "DepB_DepA", "Factory resolves dependencies correctly");

  console.log("\n[Test 18] Dispose clears singleton cache");
  const container18 = new ServiceContainer();
  let factoryCalls18 = 0;
  container18.register(TokenA, () => { factoryCalls18++; return new MockService("Cached"); }, ServiceLifetime.Singleton);
  container18.resolve(TokenA);
  await container18.dispose();
  try { container18.resolve(TokenA); assert(false, "Should throw"); } 
  catch (e: any) { assert(e.message.includes("No provider registered"), "Fails after dispose"); }

  console.log("\n[Test 19] Singleton cache ONLY after success (No poisoning)");
  const container19 = new ServiceContainer();
  let factoryCalls19 = 0;
  container19.register(TokenA, () => {
    factoryCalls19++;
    if (factoryCalls19 < 3) throw new Error("Transient failure");
    return new MockService("Success");
  }, ServiceLifetime.Singleton);

  try { container19.resolve(TokenA); } catch {}
  try { container19.resolve(TokenA); } catch {}
  const inst19a = container19.resolve(TokenA);
  assert(inst19a?.id === "Success", "Should succeed on 3rd try");
  assert(factoryCalls19 === 3, `Factory called 3 times (called ${factoryCalls19})`);
  
  const inst19b = container19.resolve(TokenA);
  assert(inst19a === inst19b, "Should return cached instance after success");
  assert(factoryCalls19 === 3, `Factory NOT called again (still ${factoryCalls19})`);

  console.log("\n" + "=".repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log("=".repeat(60));
  if (failed === 0) console.log("\n🎉 All 19 tests passed! Commit 10 is ready for Freeze. 🎉");
  else console.log(`\n${failed} test(s) failed.`);
}

runTests().catch((error) => { console.error("Fatal:", error); process.exit(1); });
