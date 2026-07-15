// src/infrastructure/CredentialVault.v7.5.0.ts
// ============================================================
// GAPGPT V7
// Credential Vault - Abstraction Layer
// Commit 5.0
// Status: Frozen
// ============================================================

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ICredentialProvider } from "../types/AuthTypes.js";

export class CredentialVault implements ICredentialProvider {
  private readonly vaultPath: string;
  private readonly encryptionKey: string;

  constructor(vaultPath: string = "./credentials.json") {
    this.vaultPath = path.resolve(process.cwd(), vaultPath);
    this.encryptionKey = this.loadOrCreateEncryptionKey();
  }

  private loadOrCreateEncryptionKey(): string {
    const envKey = process.env.GAPGPT_VAULT_KEY;
    if (envKey) return envKey;

    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new Error("GAPGPT_VAULT_KEY is not configured in production environment.");
    }

    console.warn("[CredentialVault] GAPGPT_VAULT_KEY not set. Using development fallback key.");
    return "default-dev-key-change-in-production";
  }

  private getDerivedKey(): Buffer {
    return crypto.createHash("sha256").update(this.encryptionKey, "utf-8").digest();
  }

  private async readVault(): Promise<Record<string, string>> {
    try {
      const encrypted = await fs.readFile(this.vaultPath, "utf-8");
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted) as Record<string, string>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeVault(data: Record<string, string>): Promise<void> {
    const dir = path.dirname(this.vaultPath);
    await fs.mkdir(dir, { recursive: true });

    const json = JSON.stringify(data, null, 2);
    const encrypted = this.encrypt(json);
    await fs.writeFile(this.vaultPath, encrypted, "utf-8");
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.getDerivedKey(), iv);

    let encrypted = cipher.update(text, "utf-8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  private decrypt(encrypted: string): string {
    if (!encrypted.includes(":")) {
      throw new Error("CredentialVault: Vault data is corrupted (missing delimiter).");
    }

    const parts = encrypted.split(":");
    if (parts.length !== 3) {
      throw new Error("CredentialVault: Vault data is corrupted (invalid format).");
    }

    const ivHex = parts[0];
    const authTagHex = parts[1];
    const data = parts[2];

    if (!ivHex || !authTagHex || !data) {
      throw new Error("CredentialVault: Vault data is corrupted (missing components).");
    }

    if (ivHex.length !== 32 || authTagHex.length !== 32) {
      throw new Error("CredentialVault: Vault data is corrupted (invalid IV or auth tag length).");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", this.getDerivedKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data, "hex", "utf-8") as string;
    decrypted += decipher.final("utf-8") as string;

    return decrypted;
  }

  public async getSecret(name: string): Promise<string | null> {
    const vault = await this.readVault();
    return vault[name] || null;
  }

  public async setSecret(name: string, value: string): Promise<void> {
    const vault = await this.readVault();
    vault[name] = value;
    await this.writeVault(vault);
  }

  public async deleteSecret(name: string): Promise<void> {
    const vault = await this.readVault();
    delete vault[name];
    await this.writeVault(vault);
  }

  public async getApiKey(name: string): Promise<string | null> {
    return this.getSecret(`apikey:${name}`);
  }

  public async setApiKey(name: string, key: string): Promise<void> {
    await this.setSecret(`apikey:${name}`, key);
  }

  public async deleteApiKey(name: string): Promise<void> {
    await this.deleteSecret(`apikey:${name}`);
  }

  public async getPasswordHash(username: string): Promise<string | null> {
    return this.getSecret(`password:${username}`);
  }

  public async setPasswordHash(username: string, hash: string): Promise<void> {
    await this.setSecret(`password:${username}`, hash);
  }
}
