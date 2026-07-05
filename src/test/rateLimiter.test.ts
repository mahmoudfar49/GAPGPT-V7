import { RateLimiter } from "../infrastructure/RateLimiter.js";
import { Timer } from "../core/Timer.js";
import {
  printSection,
  printSuccess,
  printInfo,
} from "./helpers/testUtils.js";

export async function runRateLimiterTest(): Promise<void> {
  printSection("RateLimiter Test");

  printInfo("Starting RateLimiter integration test...");

  const rateLimiter = new RateLimiter();

  printInfo(
    `Available tokens initially: ${rateLimiter.getAvailableTokens()}`
  );

  const consumeFirst = rateLimiter.consume();
  printInfo(`Consume #1: ${consumeFirst}`);

  const consumeSecond = rateLimiter.consume();
  printInfo(`Consume #2: ${consumeSecond}`);

  if (!consumeFirst) {
    throw new Error("First consume should succeed.");
  }

  if (consumeSecond) {
    throw new Error("Second immediate consume should fail.");
  }

  printInfo("Waiting for token...");

  const startedAt = Timer.now();

  await rateLimiter.waitForToken();

  const elapsedMs = Timer.now() - startedAt;

  if (elapsedMs < 0) {
    throw new Error("Elapsed time cannot be negative.");
  }

  printInfo(`Elapsed waiting time: ${elapsedMs}ms`);

  printInfo(
    `Available tokens after wait: ${rateLimiter.getAvailableTokens()}`
  );

  printSuccess("RateLimiter behavior validated successfully.");
}