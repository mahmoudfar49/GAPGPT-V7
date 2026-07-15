// src/infrastructure/AuthenticationManager.v7.5.0.ts
// ============================================================
// GAPGPT V7
// Authentication Manager - Interface-Based
// Commit 5.0
// Status: Frozen
// ============================================================

import crypto from "node:crypto";
import {
  User,
  LoginAttempt,
  AuthenticationResult,
  AuthenticationConfig,
  IAuthenticationProvider,
  IPasswordHasher,
  ICredentialProvider,
  ISessionProvider,
} from "../types/AuthTypes.js";

export const DEFAULT_AUTH_CONFIG: AuthenticationConfig = Object.freeze({
  maxLoginAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000,
});

interface FailedLoginRecord {
  readonly attempts: number;
  readonly lockedUntil?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === "string" || typeof value === "undefined";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return typeof value === "number" || typeof value === "undefined";
}

function isUserRole(value: unknown): value is User["role"] {
  return value === "admin" || value === "analyst" || value === "viewer";
}

function isValidDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function assertValidUser(value: unknown, context: string): asserts value is User {
  if (!isRecord(value)) {
    throw new Error(`AuthenticationManager: ${context} is not a valid object.`);
  }
  const {
    id,
    username,
    passwordHash,
    role,
    createdAt,
    lastLogin,
    failedLoginAttempts,
    lockedUntil,
    isActive,
  } = value;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`AuthenticationManager: ${context} is missing a valid id.`);
  }
  if (typeof username !== "string" || username.length === 0) {
    throw new Error(`AuthenticationManager: ${context} is missing a valid username.`);
  }
  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    throw new Error(`AuthenticationManager: ${context} is missing a valid passwordHash.`);
  }
  if (!isUserRole(role)) {
    throw new Error(`AuthenticationManager: ${context} has an invalid role.`);
  }
  if (typeof createdAt !== "string" || !isValidDateString(createdAt)) {
    throw new Error(`AuthenticationManager: ${context} has an invalid createdAt.`);
  }
  if (!isOptionalString(lastLogin) || (lastLogin && !isValidDateString(lastLogin))) {
    throw new Error(`AuthenticationManager: ${context} has an invalid lastLogin.`);
  }
  if (!isOptionalNumber(failedLoginAttempts)) {
    throw new Error(`AuthenticationManager: ${context} has an invalid failedLoginAttempts.`);
  }
  if (!isOptionalString(lockedUntil) || (lockedUntil && !isValidDateString(lockedUntil))) {
    throw new Error(`AuthenticationManager: ${context} has an invalid lockedUntil.`);
  }
  if (typeof isActive !== "boolean") {
    throw new Error(`AuthenticationManager: ${context} is missing a valid isActive flag.`);
  }
}

export class AuthenticationManager implements IAuthenticationProvider {
  private readonly passwordHasher: IPasswordHasher;
  private readonly credentialProvider: ICredentialProvider;
  private readonly sessionProvider: ISessionProvider;
  private readonly config: AuthenticationConfig;
  private readonly failedLogins: Map<string, FailedLoginRecord>;
  private readonly users: Map<string, User>;
  private readonly auditLog: LoginAttempt[];
  private usersLoaded: boolean;

  constructor(
    passwordHasher: IPasswordHasher,
    credentialProvider: ICredentialProvider,
    sessionProvider: ISessionProvider,
    config: AuthenticationConfig = DEFAULT_AUTH_CONFIG,
  ) {
    this.passwordHasher = passwordHasher;
    this.credentialProvider = credentialProvider;
    this.sessionProvider = sessionProvider;
    this.config = config;
    this.failedLogins = new Map();
    this.users = new Map();
    this.auditLog = [];
    this.usersLoaded = false;
  }

  private async ensureUsersLoaded(): Promise<void> {
    if (this.usersLoaded) return;

    const registryJson = await this.credentialProvider.getSecret("user_registry");
    if (!registryJson) {
      this.usersLoaded = true;
      return;
    }

    const registry = this.parseUserRegistry(registryJson);
    const loadedUsers = new Map<string, User>();

    for (const userId of registry) {
      const userJson = await this.credentialProvider.getSecret(`user:${userId}`);
      if (!userJson) continue;

      const parsed = this.parseJson(userJson, `user:${userId}`);
      assertValidUser(parsed, `user:${userId}`);

      if (parsed.id !== userId) {
        throw new Error(`AuthenticationManager: user:${userId} payload id does not match registry entry.`);
      }

      loadedUsers.set(parsed.id, Object.freeze({ ...parsed }));
      await this.syncLegacyPasswordSecret(parsed);
    }

    this.users.clear();
    for (const [userId, user] of loadedUsers.entries()) {
      this.users.set(userId, user);
    }
    this.usersLoaded = true;
  }

  private parseUserRegistry(registryJson: string): string[] {
    const parsed = this.parseJson(registryJson, "user_registry");
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error("AuthenticationManager: user_registry must be a string array.");
    }
    return Array.from(new Set(parsed));
  }

  private parseJson(json: string, context: string): unknown {
    try {
      return JSON.parse(json) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parsing error.";
      throw new Error(`AuthenticationManager: failed to parse ${context}: ${message}`);
    }
  }

  private async syncLegacyPasswordSecret(user: User): Promise<void> {
    const legacyKey = `password:${user.username}`;
    const legacyHash = await this.credentialProvider.getSecret(legacyKey);
    if (legacyHash !== user.passwordHash) {
      await this.credentialProvider.setSecret(legacyKey, user.passwordHash);
    }
  }

  private async saveUserToVault(user: User): Promise<void> {
    await this.credentialProvider.setSecret(`user:${user.id}`, JSON.stringify(user));
    await this.credentialProvider.setSecret(`password:${user.username}`, user.passwordHash);

    const registryJson = await this.credentialProvider.getSecret("user_registry");
    const registry = registryJson ? this.parseUserRegistry(registryJson) : [];

    if (!registry.includes(user.id)) {
      registry.push(user.id);
      await this.credentialProvider.setSecret("user_registry", JSON.stringify(registry));
    }
  }

  public async initializeDefaultUser(
    username: string,
    password: string,
    role: User["role"] = "admin",
  ): Promise<User> {
    await this.ensureUsersLoaded();

    const existing = Array.from(this.users.values()).find((user) => user.username === username);
    if (existing) {
      await this.syncLegacyPasswordSecret(existing);
      return existing;
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user: User = Object.freeze({
      id: crypto.randomUUID(),
      username,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
      isActive: true,
    });

    this.users.set(user.id, user);
    await this.saveUserToVault(user);
    return user;
  }

  public async validateCredentials(
    username: string,
    password: string,
  ): Promise<AuthenticationResult> {
    await this.ensureUsersLoaded();

    const failed = this.failedLogins.get(username);
    if (failed?.lockedUntil && new Date(failed.lockedUntil) > new Date()) {
      this.recordAudit(username, false);
      return { success: false, error: "ACCOUNT_LOCKED" };
    }

    const user = Array.from(this.users.values()).find((candidate) => candidate.username === username);
    if (!user) {
      this.recordFailedLogin(username);
      this.recordAudit(username, false);
      return { success: false, error: "INVALID_CREDENTIALS" };
    }

    if (!user.isActive) {
      this.recordAudit(username, false);
      return { success: false, error: "ACCOUNT_DISABLED" };
    }

    await this.syncLegacyPasswordSecret(user);

    const isValid = await this.passwordHasher.verify(password, user.passwordHash);
    if (!isValid) {
      this.recordFailedLogin(username);
      this.recordAudit(username, false);
      return { success: false, error: "INVALID_CREDENTIALS" };
    }

    this.failedLogins.delete(username);
    await this.updateLastLogin(user.id);
    this.recordAudit(username, true);

    return {
      success: true,
      user: (await this.getUser(user.id)) ?? user,
    };
  }

  public async getUser(userId: string): Promise<User | null> {
    await this.ensureUsersLoaded();
    return this.users.get(userId) ?? null;
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await this.ensureUsersLoaded();
    const user = this.users.get(userId);
    if (!user) return;

    const updated: User = Object.freeze({
      ...user,
      lastLogin: new Date().toISOString(),
      failedLoginAttempts: 0,
    });

    this.users.set(userId, updated);
    await this.saveUserToVault(updated);
  }

  public async login(username: string, password: string): Promise<AuthenticationResult> {
    const result = await this.validateCredentials(username, password);
    if (!result.success || !result.user) return result;

    const session = await this.sessionProvider.createSession(result.user.id);
    await this.sessionProvider.saveSession(session);

    return {
      success: true,
      user: result.user,
      session,
    };
  }

  public async logout(token: string): Promise<void> {
    await this.sessionProvider.deleteSession(token);
  }

  public async validateSession(token: string): Promise<User | null> {
    const session = await this.sessionProvider.getSession(token);
    if (!session) return null;

    const user = await this.getUser(session.userId);
    if (!user || !user.isActive) {
      await this.sessionProvider.deleteSession(token);
      return null;
    }

    return user;
  }

  private recordFailedLogin(username: string): void {
    const current = this.failedLogins.get(username) ?? { attempts: 0 };
    const attempts = current.attempts + 1;

    const record: FailedLoginRecord =
      attempts >= this.config.maxLoginAttempts
        ? {
            attempts,
            lockedUntil: new Date(Date.now() + this.config.lockoutDurationMs).toISOString(),
          }
        : { attempts };

    this.failedLogins.set(username, record);
  }

  private recordAudit(username: string, success: boolean): void {
    this.auditLog.push(
      Object.freeze({
        username,
        timestamp: new Date().toISOString(),
        success,
      }),
    );
  }

  public getAuditLog(): readonly LoginAttempt[] {
    return Object.freeze([...this.auditLog]);
  }
}
