import { RateLimiter } from "./infrastructure/RateLimiter.js";

async function main(): Promise<void> {

    const limiter = new RateLimiter();

    console.log("========== TEST START ==========");

    console.log("Available:", limiter.getAvailableTokens());

    console.log("Consume #1:", limiter.consume());

    console.log("Available:", limiter.getAvailableTokens());

    console.log("Consume #2:", limiter.consume());

    console.log("Waiting for token...");

    await limiter.waitForToken();

    console.log("Token received.");

    console.log("Available:", limiter.getAvailableTokens());

    console.log("========== TEST END ==========");
}

main().catch(console.error);