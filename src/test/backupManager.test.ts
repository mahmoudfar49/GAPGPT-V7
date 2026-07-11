// ============================================================
// GAPGPT V7
// BackupManager Tests
// Commit 4.1 Stable
// ============================================================

import fs from "node:fs/promises";
import path from "node:path";

import { BackupManager } from "../infrastructure/BackupManager.js";
import {
  BackupMode,
  SecurityConfig,
} from "../config/SecurityConfig.js";

import {
  ok,
  write,
  printSection,
  printSuccess,
} from "./helpers/testUtils.js";

export async function runBackupManagerTest(): Promise<void> {

  printSection("BackupManager");

  const config = SecurityConfig.backup;

  const manager = new BackupManager(
    config,
    "GAPGPT-V7",
  );

  //-------------------------------------------------------
  // Clean backup directory
  //-------------------------------------------------------

  await fs.rm(

    path.resolve(
      process.cwd(),
      config.rootDirectory,
    ),

    {
      recursive: true,
      force: true,
    },

  );

  //-------------------------------------------------------
  // Create Backup
  //-------------------------------------------------------

  write("Creating backup...");

  const metadata =
    await manager.createBackup(
      "manual" as BackupMode,
      "Commit 4 Test Backup",
    );

  ok(
    metadata.id.length > 0,
    "Backup id generated",
  );

  ok(
    metadata.sha256.length === 64,
    "SHA256 generated",
  );

  ok(
    metadata.sizeBytes > 0,
    "ZIP size recorded",
  );

  //-------------------------------------------------------
  // List
  //-------------------------------------------------------

  write("Listing backups...");

  const backups =
    await manager.listBackups();

  ok(
    backups.length >= 1,
    "Backup listed",
  );

  //-------------------------------------------------------
  // Verify
  //-------------------------------------------------------

  write("Verifying backup...");

  const verified =
    await manager.verifyBackup(
      metadata.id,
    );

  ok(
    verified,
    "Checksum verified",
  );

  //-------------------------------------------------------
  // Retention
  //-------------------------------------------------------

  write("Retention policy...");

  const retention =
    await manager.applyRetentionPolicy();

  ok(

    retention.remainingCount >= 1,

    "Retention OK",

  );

  //-------------------------------------------------------
  // Restore Stub
  //-------------------------------------------------------

  write("Restore stub...");

  let threw = false;

  try {

    await manager.restoreBackup(
      metadata.id,
    );

  }

  catch {

    threw = true;

  }

  ok(
    threw,
    "Restore throws (stub)",
  );

  //-------------------------------------------------------
  // Delete
  //-------------------------------------------------------

  write("Deleting backup...");

  await manager.deleteBackup(
    metadata.id,
  );

  const backups2 =
    await manager.listBackups();

  ok(

    backups2.every(

      backup =>
        backup.id !== metadata.id,

    ),

    "Backup removed",

  );

  printSuccess(
    "BackupManager tests passed.",
  );

}