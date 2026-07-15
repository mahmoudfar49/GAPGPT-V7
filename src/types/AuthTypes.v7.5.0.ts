// src/types/AuthTypes.v7.5.0.ts
// ============================================================
// GAPGPT V7
// Authentication Types and Interfaces
// Commit 5.0
// Status: Frozen
// ============================================================

export type UserRole = "admin" | "analyst" | "viewer";

export type HashAlgorithm = "sha256" | "sha512" | "scrypt";

export type AuthenticationError =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_DISABLED"
  | "SESSION_EXPIRED"
  | "SESSION_INVALID"
  | "VAULT_ERROR"
  | "HASH_ERROR";

export interface User {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly createdAt: string;
  readonly lastLogin?: string;
  readonly failedLoginAttempts?: number;
  readonly lockedUntil?: string;
  readonly isActive: boolean;
}

export interface Session {
  readonly id: string;
  readonly token: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly isActive: boolean;
}

export interface LoginAttempt {
  readonly username: string;
  readonly timestamp: string;
  readonly success: boolean;
  readonly ipAddress?: string;
}

export interface AuthenticationResult {
  readonly success: boolean;
  readonly user?: User;
  readonly session?: Session;
  readonly error?: AuthenticationError;
}

// ============================================================
// Configuration Interfaces
// ============================================================

export interface PasswordHasherConfig {
  readonly algorithm: HashAlgorithm;
  readonly iterations: number;
  readonly keyLength: number;
}

export interface SessionConfig {
  readonly durationHours: number;
  readonly slidingWindowEnabled: boolean;
  readonly slidingWindowMinutes: number;
}

export interface AuthenticationConfig {
  readonly maxLoginAttempts: number;
  readonly lockoutDurationMs: number;
}

// ============================================================
// Interface-Based Architecture (Rule 1 & 2)
// ============================================================

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hashedPassword: string): Promise<boolean>;
}

export interface ICredentialProvider {
  setSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  deleteSecret(key: string): Promise<void>;
}

export interface ISessionProvider {
  createSession(userId: string): Promise<Session>;
  saveSession(session: Session): Promise<void>;
  getSession(token: string): Promise<Session | null>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<number>;
  cleanupExpiredSessions(): Promise<number>;
}

export interface IAuthenticationProvider {
  validateCredentials(username: string, password: string): Promise<AuthenticationResult>;
  login(username: string, password: string): Promise<AuthenticationResult>;
  logout(token: string): Promise<void>;
  validateSession(token: string): Promise<User | null>;
  getUser(userId: string): Promise<User | null>;
}
