// src/infrastructure/SessionManager.v1.Rev.5.ts
// ============================================================
// GAPGPT V7
// Session Manager Implementation - Token-Based Indexing
// Commit 5.0
// Status: Frozen
// ============================================================

import crypto from "node:crypto";
import { Session, ISessionProvider, SessionConfig } from "../types/AuthTypes.js";

export const DEFAULT_SESSION_CONFIG: SessionConfig = Object.freeze({
  durationHours: 24,
  slidingWindowEnabled: true,
  slidingWindowMinutes: 30,
});

export class SessionManager implements ISessionProvider {
  private readonly sessionsByToken: Map<string, Session>;
  private readonly sessionsByUser: Map<string, Set<string>>;
  private readonly config: SessionConfig;
  private readonly durationMs: number;

  constructor(config: SessionConfig = DEFAULT_SESSION_CONFIG) {
    this.sessionsByToken = new Map();
    this.sessionsByUser = new Map();
    this.config = config;
    this.durationMs = config.durationHours * 60 * 60 * 1000;
  }

  /* ============================================================
     Session Creation (Pure Factory - NO Side Effects)
     ============================================================ */

  public async createSession(userId: string): Promise<Session> {
    let session = this.buildSession(userId);
    
    // Defense in Depth: Prevent token collision
    while (this.sessionsByToken.has(session.token)) {
      session = this.buildSession(userId);
    }
    
    // NOTE: We DO NOT call saveSession here. 
    // The caller (AuthenticationManager) is responsible for persisting it.
    return session;
  }

  private buildSession(userId: string): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.durationMs);
    return Object.freeze({
      id: crypto.randomUUID(),
      userId,
      token: crypto.randomBytes(32).toString("hex"),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    });
  }

  /* ============================================================
     ISessionProvider Implementation
     ============================================================ */

  public async saveSession(session: Session): Promise<void> {
    this.sessionsByToken.set(session.token, session);
    let userTokens = this.sessionsByUser.get(session.userId);
    if (!userTokens) {
      userTokens = new Set();
      this.sessionsByUser.set(session.userId, userTokens);
    }
    userTokens.add(session.token);
  }

  public async getSession(token: string): Promise<Session | null> {
    const session = this.sessionsByToken.get(token);
    if (!session) return null;

    if (!this.isSessionValid(session)) {
      await this.deleteSession(token);
      return null;
    }

    if (this.config.slidingWindowEnabled) {
      return this.refreshSession(session);
    }
    return session;
  }

  public async deleteSession(token: string): Promise<void> {
    const session = this.sessionsByToken.get(token);
    if (!session) return;

    this.sessionsByToken.delete(token);
    const userTokens = this.sessionsByUser.get(session.userId);
    if (userTokens) {
      userTokens.delete(token);
      if (userTokens.size === 0) {
        this.sessionsByUser.delete(session.userId);
      }
    }
  }

  public async deleteUserSessions(userId: string): Promise<number> {
    const userTokens = this.sessionsByUser.get(userId);
    if (!userTokens) return 0;

    const tokens = Array.from(userTokens);
    for (const token of tokens) {
      this.sessionsByToken.delete(token);
    }
    this.sessionsByUser.delete(userId);
    return tokens.length;
  }

  public async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, session] of this.sessionsByToken.entries()) {
      if (new Date(session.expiresAt) <= now || !session.isActive) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      await this.deleteSession(token);
    }
    return expiredTokens.length;
  }

  public async getActiveSessionCount(): Promise<number> {
    let count = 0;
    for (const [token, session] of this.sessionsByToken.entries()) {
      if (this.isSessionValid(session)) count += 1;
      else await this.deleteSession(token);
    }
    return count;
  }

  public async getUserSessions(userId: string): Promise<readonly Session[]> {
    const userTokens = this.sessionsByUser.get(userId);
    if (!userTokens) return Object.freeze([]);

    const sessions: Session[] = [];
    for (const token of Array.from(userTokens)) {
      const session = this.sessionsByToken.get(token);
      if (!session) {
        userTokens.delete(token);
        continue;
      }
      if (!this.isSessionValid(session)) {
        await this.deleteSession(token);
        continue;
      }
      sessions.push(session);
    }

    if (userTokens.size === 0) this.sessionsByUser.delete(userId);
    return Object.freeze(sessions);
  }

  public async revokeAllSessions(): Promise<number> {
    const count = this.sessionsByToken.size;
    this.sessionsByToken.clear();
    this.sessionsByUser.clear();
    return count;
  }

  /* ============================================================
     Internal Helpers
     ============================================================ */

  private isSessionValid(session: Session): boolean {
    return session.isActive && new Date(session.expiresAt) > new Date();
  }

  private refreshSession(session: Session): Session {
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    const remainingMs = expiresAt.getTime() - now.getTime();
    const slidingMs = this.config.slidingWindowMinutes * 60 * 1000;

    if (remainingMs >= slidingMs) return session;

    const newExpiresAt = new Date(now.getTime() + this.durationMs);
    const refreshed: Session = Object.freeze({
      ...session,
      expiresAt: newExpiresAt.toISOString(),
    });

    this.sessionsByToken.set(session.token, refreshed);
    return refreshed;
  }
}
