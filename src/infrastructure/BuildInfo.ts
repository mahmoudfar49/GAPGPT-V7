// ============================================================
// GAPGPT V7
// Build Information & Runtime Metadata - Deployment Env Added
// Commit 4.1 Stable
// ============================================================

import fs from "node:fs/promises";
import path from "node:path";

export type BuildEnvironment = "development" | "production" | "staging";

export class BuildInfo {
  private constructor() {}

  public static async readProjectVersion(): Promise<string> {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    let packageJson: unknown;

    try {
      const raw = await fs.readFile(packageJsonPath, "utf-8");
      packageJson = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to read project version from package.json: ${String(error)}`);
    }

    const pkg = packageJson as { version?: string };
    if (!pkg.version) {
      throw new Error("package.json does not contain a valid version field.");
    }

    return `v${pkg.version}`;
  }

  /**
   * Returns complete system and build level runtime metadata.
   */
  public static async readEnvironment(): Promise<any> {
    // قرارداد قدیمی برای بخش‌های دیگر پروژه دست‌نخورده باقی می‌ماند
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * ✅ FIX: Returns the clean, strongly-typed target deployment environment string.
   */
  public static readDeploymentEnvironment(): BuildEnvironment {
    const env = process.env.NODE_ENV;
    if (env === "production") return "production";
    if (env === "staging") return "staging";
    return "development";
  }
}