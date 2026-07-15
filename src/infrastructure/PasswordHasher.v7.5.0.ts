// src/infrastructure/PasswordHasher.v7.5.0.ts
// ============================================================
// GAPGPT V7
// Password Hasher - Interface-Based
// Commit 5.0
// Status: Frozen
// ============================================================

import crypto from "node:crypto";
import { IPasswordHasher, PasswordHasherConfig } from "../types/AuthTypes.js";

export const DEFAULT_PASSWORD_HASHER_CONFIG: PasswordHasherConfig = Object.freeze({
  algorithm: "sha512",
  iterations: 100000,
  keyLength: 64,
});

export class PasswordHasher implements IPasswordHasher {
  private readonly config: PasswordHasherConfig;

  constructor(config: PasswordHasherConfig = DEFAULT_PASSWORD_HASHER_CONFIG) {
    this.config = config;
  }

  public async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await this.pbkdf2(password, salt);
    return `${salt}:${hash}`;
  }

  public async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;

    const salt = parts[0];
    const hash = parts[1];

    if (!salt || !hash) return false;

    const computedHash = await this.pbkdf2(password, salt);

    const expected = Buffer.from(hash, "hex");
    const actual = Buffer.from(computedHash, "hex");

    if (expected.length !== actual.length) {
      return false;
    }

    return crypto.timingSafeEqual(expected, actual);
  }

  private pbkdf2(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        this.config.iterations,
        this.config.keyLength,
        this.config.algorithm,
        (err, derivedKey) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(derivedKey.toString("hex"));
        },
      );
    });
  }
}
