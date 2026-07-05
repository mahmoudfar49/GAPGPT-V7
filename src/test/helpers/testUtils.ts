function timestamp(): string {
  return new Date().toISOString();
}

function write(message: string): void {
  console.log(message);
}

function writeError(message: string): void {
  console.error(message);
}

export function printSection(title: string): void {
  write(`\n=== [ ${title} ] ===`);
}

export function printSuccess(message: string): void {
  write(`✅ [${timestamp()}] ${message}`);
}

export function printInfo(message: string): void {
  write(`ℹ️ [${timestamp()}] ${message}`);
}

export function printWarning(message: string): void {
  write(`⚠️ [${timestamp()}] ${message}`);
}

export function printFailure(message: string): void {
  writeError(`❌ [${timestamp()}] ${message}`);
}