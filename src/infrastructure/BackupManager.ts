// ============================================================
// GAPGPT V7
// Backup Manager Implementation - Strongly Typed Deployment Env
// Commit 4.1 Stable
// ============================================================

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as archiverModule from "archiver"; 
import { Archiver } from "archiver";

import {
  BackupConfig,
  BackupDestination,
  BackupMode,
} from "../config/SecurityConfig.js";

import { BuildInfo, BuildEnvironment } from "./BuildInfo.js";

import {
  BackupManifest,
  BackupMetadata,
  RetentionResult,
  BackupErrors,
} from "./BackupTypes.js";

const MANIFEST_VERSION = 1 as const;

const archiver = ((archiverModule as any).default ?? archiverModule) as any;

type ArchiverFactory = (
  format: "zip",
  options?: { zlib?: { level?: number } },
) => Archiver;

const createArchiver = archiver as unknown as ArchiverFactory;

type CreateBackupOptions = {
  readonly mode: BackupMode;
  readonly description?: string;
  readonly sourceDir?: string;
};

export class BackupManager {
  private readonly config: BackupConfig;
  private readonly appName: string;
  private cachedProjectVersion?: string;
  private cachedEnvironment?: BuildEnvironment; // Matches BuildInfo layout

  constructor(config: BackupConfig, appName = "GAPGPT-V7") {
    if (!config) throw new Error("BackupConfig is required.");
    this.config = config;
    this.appName = appName;
  }

  /* ============================================================
     Public API
     ============================================================ */

  public async createBackup(mode: BackupMode, description?: string): Promise<BackupMetadata> {
    return this.createBackupWithOptions(
      description === undefined ? { mode } : { mode, description }
    );
  }

  public async verifyBackup(backupId: string, destinationId?: string): Promise<boolean> {
    const manifest = await this.readGlobalManifest();
    const metadata = manifest.backups.find((backup) => backup.id === backupId);

    if (!metadata) throw BackupErrors.notFound(backupId);

    const zipPath = await this.resolveBackupZipPath(metadata, destinationId);
    const checksum = await this.computeSha256(zipPath);

    if (checksum !== metadata.sha256) {
      throw BackupErrors.checksumMismatch(metadata.filename);
    }

    return true;
  }

  public async restoreBackup(backupId: string, destinationId?: string): Promise<void> {
    void backupId; void destinationId;
    throw new Error("restoreBackup() is not implemented in Commit 4. Reserved for Commit 5.");
  }

  public async listBackups(): Promise<readonly BackupMetadata[]> {
    const manifest = await this.readGlobalManifest();
    return Object.freeze([...manifest.backups].sort((a, b) => b.id.localeCompare(a.id)));
  }

  public async deleteBackup(backupId: string): Promise<void> {
    const manifest = await this.readGlobalManifest();
    const metadata = manifest.backups.find((backup) => backup.id === backupId);

    if (!metadata) throw BackupErrors.notFound(backupId);

    const destinations = this.getEnabledDestinations();
    for (const destination of destinations) {
      const zipPath = this.destinationZipPath(destination, metadata.filename);
      await this.safeDeleteFile(zipPath);
    }

    const nextManifest = Object.freeze<BackupManifest>({
      manifestVersion: MANIFEST_VERSION,
      updated: new Date().toISOString(),
      backups: Object.freeze(manifest.backups.filter((backup) => backup.id !== backupId)),
    });

    await this.writeGlobalManifest(nextManifest);
  }

  public async applyRetentionPolicy(): Promise<RetentionResult> {
    const manifest = await this.readGlobalManifest();
    const maxBackups = this.config.retention.maxBackups;

    if (maxBackups <= 0) {
      return Object.freeze<RetentionResult>({ deletedIds: Object.freeze([]), remainingCount: manifest.backups.length });
    }

    const sorted = [...manifest.backups].sort((a, b) => b.id.localeCompare(a.id));
    const toDelete = sorted.slice(maxBackups);
    const deletedIds: string[] = [];

    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
      deletedIds.push(backup.id);
    }

    const refreshedManifest = await this.readGlobalManifest();
    return Object.freeze<RetentionResult>({ deletedIds: Object.freeze(deletedIds), remainingCount: refreshedManifest.backups.length });
  }

  public async computeSha256(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fssync.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  /* ============================================================
     Internal & Helper Methods
     ============================================================ */

  private async getProjectVersion(): Promise<string> {
    if (this.cachedProjectVersion) return this.cachedProjectVersion;
    this.cachedProjectVersion = await BuildInfo.readProjectVersion();
    return this.cachedProjectVersion;
  }

  /**
   * ✅ FIX: Synchronous, completely type-safe and zero type-casting required.
   */
  private getEnvironment(): BuildEnvironment {
    if (this.cachedEnvironment) return this.cachedEnvironment;
    this.cachedEnvironment = BuildInfo.readDeploymentEnvironment();
    return this.cachedEnvironment;
  }

  private async createBackupWithOptions(options: CreateBackupOptions): Promise<BackupMetadata> {
    if (!this.config.enabled) throw new Error("Backup is disabled in SecurityConfig.");
    if (this.config.compressionFormat !== "zip") throw new Error(`Unsupported compression: ${this.config.compressionFormat}`);

    const sourceDir = options.sourceDir ?? path.resolve(process.cwd(), "src");
    await this.ensureDirectoryExists(sourceDir);

    const projectVersion = await this.getProjectVersion();
    const environment = this.getEnvironment(); // Invoked cleanly

    const now = new Date();
    const id = this.generateBackupId(now);
    const timestamp = now.toISOString();
    const filename = `${this.appName}_${projectVersion}_${id}.zip`;

    const tempDirectory = path.resolve(process.cwd(), this.config.rootDirectory, "tmp");
    await this.ensureDirectory(tempDirectory);
    const temporaryZipPath = path.join(tempDirectory, filename);

    const partialMetadata: Omit<BackupMetadata, "sha256" | "sizeBytes"> = Object.freeze({
      manifestVersion: MANIFEST_VERSION,
      id,
      timestamp,
      mode: options.mode,
      ...(options.description !== undefined ? { description: options.description } : {}),
      filename,
      compressionFormat: "zip" as const,
      projectVersion,
      environment,
    });

    await this.createZipFromDirectory({
      sourceDir,
      outputZipPath: temporaryZipPath,
      embeddedManifest: JSON.stringify(Object.freeze({ generator: "GAPGPT V7", ...partialMetadata }), null, 2),
    });

    const statistics = await fs.stat(temporaryZipPath);
    const sha256 = await this.computeSha256(temporaryZipPath);

    const metadata = Object.freeze<BackupMetadata>({ ...partialMetadata, sizeBytes: statistics.size, sha256 });
    const destinations = this.getEnabledDestinations();

    if (destinations.length === 0) throw BackupErrors.noDestination();

    await Promise.all(
      destinations.map(async (destination) => {
        await this.ensureDirectory(destination.path);
        await fs.copyFile(temporaryZipPath, this.destinationZipPath(destination, filename));
      }),
    );

    const manifest = await this.readGlobalManifest();
    await this.writeGlobalManifest(Object.freeze({ manifestVersion: MANIFEST_VERSION, updated: new Date().toISOString(), backups: Object.freeze([...manifest.backups, metadata]) }));

    await this.safeDeleteFile(temporaryZipPath);
    await this.applyRetentionPolicy();

    return metadata;
  }

  private getGlobalManifestPath(): string {
    return path.resolve(process.cwd(), this.config.rootDirectory, "manifest.json");
  }

  private async readGlobalManifest(): Promise<BackupManifest> {
    const manifestPath = this.getGlobalManifestPath();
    await this.ensureDirectory(path.dirname(manifestPath));
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.manifestVersion !== MANIFEST_VERSION || typeof parsed.updated !== "string" || !Array.isArray(parsed.backups)) {
        throw new Error("Invalid schema.");
      }
      return parsed as BackupManifest;
    } catch (error) {
      if (this.isNodeError(error) && error.code === "ENOENT") {
        const empty = Object.freeze({ manifestVersion: MANIFEST_VERSION, updated: new Date().toISOString(), backups: Object.freeze([]) });
        await this.writeGlobalManifest(empty);
        return empty;
      }
      throw error;
    }
  }

  private async writeGlobalManifest(manifest: BackupManifest): Promise<void> {
    const manifestPath = this.getGlobalManifestPath();
    await this.ensureDirectory(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }

  private getEnabledDestinations(): readonly BackupDestination[] {
    return Object.freeze(this.config.destinations.filter((d) => d.enabled));
  }

  private destinationZipPath(destination: BackupDestination, filename: string): string {
    return path.resolve(process.cwd(), destination.path, filename);
  }

  private async resolveBackupZipPath(metadata: BackupMetadata, destinationId?: string): Promise<string> {
    const destinations = this.getEnabledDestinations();
    if (destinations.length === 0) throw BackupErrors.noDestination();
    const destination = destinationId === undefined ? destinations[0] : destinations.find((d) => d.id === destinationId);
    if (!destination) throw new Error("Destination not found.");
    const zipPath = this.destinationZipPath(destination, metadata.filename);
    await fs.access(zipPath);
    return zipPath;
  }

  private async createZipFromDirectory(options: { readonly sourceDir: string; readonly outputZipPath: string; readonly embeddedManifest: string }): Promise<void> {
    await this.ensureDirectory(path.dirname(options.outputZipPath));
    return new Promise<void>((resolve, reject) => {
      const output = fssync.createWriteStream(options.outputZipPath);
      const archive = createArchiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("warning", (err) => { if (err.code !== "ENOENT") console.warn("[Warning]", err); });
      archive.on("error", reject);

      archive.pipe(output);
      archive.directory(options.sourceDir, "src");
      archive.append(options.embeddedManifest, { name: "manifest.json" });
      void archive.finalize();
    });
  }

  private generateBackupId(date: Date): string {
    const pad = (v: number) => v.toString().padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${crypto.randomBytes(2).toString("hex")}`;
  }

  private async ensureDirectory(directory: string): Promise<void> { await fs.mkdir(directory, { recursive: true }); }
  private async ensureDirectoryExists(directory: string): Promise<void> { const stat = await fs.stat(directory); if (!stat.isDirectory()) throw new Error("Not a directory"); }
  private async safeDeleteFile(filePath: string): Promise<void> { try { await fs.unlink(filePath); } catch (e) { if (!this.isNodeError(e) || e.code !== "ENOENT") throw e; } }
  private isNodeError(error: unknown): error is NodeJS.ErrnoException { return typeof error === "object" && error !== null && "code" in error; }
}