import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { workerDir, workerRoot } from "./env";
import { listWorkerRelDirs } from "./worker-dir";
import { readWranglerToml } from "./wrangler-vars";
import { parseD1Databases } from "./d1-database";
import {
  listWorkerProjectsSnapshot,
  markMissingWorkerProjects,
  upsertWorkerProject,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";

export interface WorkerListWithSync {
  root: string;
  default: string;
  workers: Array<{ dir: string; script_name: string | null }>;
  _sync: SyncMeta;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function readFileSafe(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function parseCompatibilityDate(toml: string): string | null {
  const m = toml.match(/^\s*compatibility_date\s*=\s*"([^"]*)"/m);
  return m ? m[1] : null;
}

function parseSecretManifest(text: string): Array<{ name: string; optional: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; optional: boolean }> = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(#\s*)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!m || seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ name: m[2], optional: Boolean(m[1]) });
  }
  return out;
}

function parseDevVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const v = m[2].trim();
    if (v.length > 0) out[m[1]] = v;
  }
  return out;
}

export function scanWorkerProjectsToDb(): WorkerListWithSync {
  const runId = startSyncRun("worker_fs", "projects");
  const now = Date.now();
  const rels = listWorkerRelDirs().sort();
  const activeIds: string[] = [];

  try {
    for (const rel of rels) {
      const abs = path.resolve(workerRoot, rel === "." ? workerRoot : path.join(workerRoot, rel));
      const tomlText = readFileSafe(path.join(abs, "wrangler.toml"));
      if (tomlText === null) continue;

      const wrangler = readWranglerToml(abs);
      const devVarsText = readFileSafe(path.join(abs, ".dev.vars"));
      const manifestText = readFileSafe(path.join(abs, ".dev.vars.example"));
      const devVars = devVarsText ? parseDevVars(devVarsText) : {};
      const secrets = [
        ...(manifestText
          ? parseSecretManifest(manifestText).map((s) => ({ name: s.name, source: "manifest" }))
          : []),
        ...Object.entries(devVars).map(([name, value]) => ({
          name,
          source: "dev_vars",
          valueHash: sha256(value),
        })),
      ];

      const id = rel;
      activeIds.push(id);
      upsertWorkerProject({
        id,
        rootRel: rel,
        absDir: abs,
        scriptName: wrangler.name,
        compatibilityDate: parseCompatibilityDate(tomlText),
        tomlHash: sha256(tomlText),
        devVarsHash: devVarsText ? sha256(devVarsText) : null,
        vars: wrangler.vars,
        d1Bindings: parseD1Databases(tomlText),
        secretNames: secrets,
        now,
      });
      recordSyncEvent({
        run_id: runId,
        resource_type: "worker_project",
        resource_id: rel,
        action: "refresh",
        status: "success",
      });
    }
    markMissingWorkerProjects(activeIds);
    finishSyncRun(runId, "success", { stats: { count: activeIds.length } });
  } catch (e) {
    finishSyncRun(runId, "failed", { error: (e as Error).message });
    throw e;
  }

  return workerProjectsFromDb(syncMeta({
    source: "live",
    lastSyncedAt: now,
    ttlMs: 30_000,
    runId,
  }));
}

export function workerProjectsFromDb(meta?: SyncMeta): WorkerListWithSync {
  const rows = listWorkerProjectsSnapshot();
  const workers = rows.map((row) => ({
    dir: row.root_rel,
    script_name: row.script_name,
  }));
  const lastSyncedAt = rows.reduce<number | null>(
    (latest, row) => (latest === null || row.last_scanned_at > latest ? row.last_scanned_at : latest),
    null,
  );
  return {
    root: workerRoot,
    default: path.relative(workerRoot, workerDir) || ".",
    workers,
    _sync:
      meta ??
      syncMeta({
        source: workers.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs: 30_000,
      }),
  };
}
