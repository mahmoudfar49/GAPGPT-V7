// ============================================================
// GAPGPT V7
// Backup System Structural Types - Strict Optional Fixed
// Commit 4.1 Stable
// ============================================================

import { BackupMode } from "../config/SecurityConfig.js";

// ✅ Fix: Added "staging" to match BuildInfo.readDeploymentEnvironment() layout
export type BackupEnvironment = "development" | "production" | "test" | "staging";
export const BACKUP_MANIFEST_VERSION = 1;

export interface BackupMetadata {
  readonly manifestVersion: number;
  readonly id: string;
  readonly timestamp: string;
  readonly mode: BackupMode;
  readonly description?: string; // Resolved exactOptionalPropertyTypes conflict
  readonly filename: string;
  readonly compressionFormat: "zip";
  readonly projectVersion: string;
  readonly environment: BackupEnvironment;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface EmbeddedBackupManifest extends Omit<BackupMetadata, "sha256" | "sizeBytes"> {
  readonly generator?: string;
}

export interface BackupManifest {
  readonly manifestVersion: number;
  readonly updated: string;
  readonly backups: readonly BackupMetadata[];
}

export interface RetentionResult {
  readonly deletedIds: readonly string[];
  readonly remainingCount: number;
}

export const BackupErrors = {
  notFound: (id: string) => new Error(`Backup storage entity not found: [${id}]`),
  noDestination: () => new Error("Backup process terminated: No active destinations configured."),
  manifestCorrupted: () => new Error("Fatal: Global backup catalog manifest file is corrupted or schema version mismatch."),
  checksumMismatch: (file: string) => new Error(`Security Alert: SHA256 integrity check failed for file [${file}]. File may be corrupted.`)
};