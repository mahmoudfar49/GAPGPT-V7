// ========================================================
// GAPGPT V7
// Test Utilities
// Commit 4.1
// ========================================================

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

/* =======================================================
   Generic Output
   ======================================================= */

export function write(message: string): void {
  console.log(`${CYAN}${message}${RESET}`);
}

export function writeError(message: string): never {
  console.error(`${RED}${message}${RESET}`);
  throw new Error(message);
}

/* =======================================================
   Assertions
   ======================================================= */

export function ok(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    writeError(`FAILED: ${message}`);
  }

  console.log(`${GREEN}✔ ${message}${RESET}`);
}

/* =======================================================
   Backward Compatibility
   (Commit 3 Tests)
   ======================================================= */

export function printSection(title: string): void {
  console.log();
  console.log(`${YELLOW}========================================${RESET}`);
  console.log(`${YELLOW}${title}${RESET}`);
  console.log(`${YELLOW}========================================${RESET}`);
}

export function printSuccess(message: string): void {
  console.log(`${GREEN}✔ ${message}${RESET}`);
}

export function printInfo(message: string): void {
  console.log(`${CYAN}${message}${RESET}`);
}

/* =======================================================
   Optional Helpers
   ======================================================= */

export function fail(message: string): never {
  writeError(message);
}

export function separator(): void {
  console.log("----------------------------------------");
}