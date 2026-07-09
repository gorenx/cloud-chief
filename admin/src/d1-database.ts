import fs from "node:fs";
import path from "node:path";
import { cfApi } from "./cf";

export interface D1DatabaseRow {
  id: string;
  name: string;
  created_at?: string | null;
  version?: string | null;
}

export interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
}

export interface D1MigrationFile {
  filename: string;
  path: string;
}

export async function createD1Database(
  name: string,
): Promise<{ ok: true; database: D1DatabaseRow } | { ok: false; status: number; error: string; json: unknown }> {
  const r = await cfApi("POST", "/d1/database", { name });
  if (!r.json.success) {
    return {
      ok: false,
      status: r.status,
      error: cfErrorMessage(r.json, `创建 D1 数据库失败（HTTP ${r.status}）`),
      json: r.json,
    };
  }

  const database = normalizeD1Database(r.json.result);
  if (!database) {
    return {
      ok: false,
      status: 502,
      error: "Cloudflare D1 返回缺少 database id",
      json: r.json,
    };
  }

  return { ok: true, database };
}

export function normalizeD1Database(result: unknown): D1DatabaseRow | null {
  if (!result || typeof result !== "object") return null;
  const row = result as Record<string, unknown>;
  const id = stringOrNull(row.uuid) ?? stringOrNull(row.id);
  const name = stringOrNull(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    created_at: stringOrNull(row.created_at),
    version: stringOrNull(row.version),
  };
}

export function listD1MigrationFiles(workerDir: string): D1MigrationFile[] {
  const dir = path.join(workerDir, "migrations");
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => ({
      filename,
      path: path.join(dir, filename),
    }));
}

export async function applyD1Migrations(
  databaseId: string,
  workerDir: string,
): Promise<{ ok: true; applied: string[] } | { ok: false; applied: string[]; error: string }> {
  const files = listD1MigrationFiles(workerDir);
  const applied: string[] = [];

  for (const file of files) {
    let sql: string;
    try {
      sql = fs.readFileSync(file.path, "utf8").trim();
    } catch (e) {
      return { ok: false, applied, error: `读取 ${file.filename} 失败: ${(e as Error).message}` };
    }
    const statements = splitD1SqlStatements(sql);
    if (statements.length === 0) continue;

    for (let i = 0; i < statements.length; i++) {
      const r = await cfApi(
        "POST",
        `/d1/database/${encodeURIComponent(databaseId)}/query`,
        { sql: statements[i] },
      );
      if (!d1QuerySucceeded(r.json)) {
        return {
          ok: false,
          applied,
          error: `${file.filename} #${i + 1}: ${cfErrorMessage(r.json, `D1 query HTTP ${r.status}`)}`,
        };
      }
    }
    applied.push(file.filename);
  }

  return { ok: true, applied };
}

export function parseD1Databases(toml: string): D1DatabaseBinding[] {
  const lines = normalizeTomlLines(toml);
  return findD1Blocks(lines)
    .map((block) => {
      const values = blockValues(lines, block.start, block.end);
      const binding = values.binding;
      const database_name = values.database_name;
      const database_id = values.database_id;
      if (!binding || !database_name || !database_id) return null;
      return { binding, database_name, database_id };
    })
    .filter((row): row is D1DatabaseBinding => row !== null);
}

export function setD1DatabaseBinding(toml: string, binding: D1DatabaseBinding): string {
  const lines = normalizeTomlLines(toml);
  const blocks = findD1Blocks(lines);
  const target = blocks.find((block) => blockValues(lines, block.start, block.end).binding === binding.binding);

  if (target) {
    upsertTomlBlockKeys(lines, target.start + 1, target.end, {
      binding: binding.binding,
      database_name: binding.database_name,
      database_id: binding.database_id,
    });
  } else {
    if (lines.length > 0 && lines[lines.length - 1].trim()) lines.push("");
    lines.push(
      "[[d1_databases]]",
      `binding = ${JSON.stringify(binding.binding)}`,
      `database_name = ${JSON.stringify(binding.database_name)}`,
      `database_id = ${JSON.stringify(binding.database_id)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function writeD1DatabaseBinding(
  workerDir: string,
  binding: D1DatabaseBinding,
): { ok: true; databases: D1DatabaseBinding[] } | { ok: false; error: string } {
  const file = path.join(workerDir, "wrangler.toml");
  let toml: string;
  try {
    toml = fs.readFileSync(file, "utf8");
  } catch {
    return { ok: false, error: "wrangler.toml 不存在" };
  }

  const next = setD1DatabaseBinding(toml, binding);
  try {
    fs.writeFileSync(file, next);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, databases: parseD1Databases(next) };
}

export function splitD1SqlStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === "\n") {
        lineComment = false;
        current += ch;
      }
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (!quote && ch === "-" && next === "-") {
      lineComment = true;
      i++;
      continue;
    }

    if (!quote && ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === quote) {
        if ((quote === "'" || quote === '"') && next === quote) {
          current += next;
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === ";") {
      const statement = current.trim();
      if (statement) out.push(statement);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

function normalizeTomlLines(toml: string): string[] {
  const lines = toml.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function findD1Blocks(lines: string[]): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isD1Header(lines[i])) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (isTomlHeader(lines[j])) {
        end = j;
        break;
      }
    }
    blocks.push({ start: i, end });
  }
  return blocks;
}

function upsertTomlBlockKeys(
  lines: string[],
  start: number,
  end: number,
  values: Record<string, string>,
): void {
  const remaining = { ...values };
  let insertAt = end;
  for (let i = start; i < insertAt; i++) {
    const m = lines[i].match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/);
    if (!m) continue;
    const key = m[2];
    if (!(key in remaining)) continue;
    lines[i] = `${m[1]}${key} = ${JSON.stringify(remaining[key])}`;
    delete remaining[key];
  }
  const toInsert = Object.entries(remaining).map(
    ([key, value]) => `${key} = ${JSON.stringify(value)}`,
  );
  if (toInsert.length) lines.splice(insertAt, 0, ...toInsert);
}

function blockValues(lines: string[], start: number, end: number): Record<string, string> {
  const values: Record<string, string> = {};
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*(?:#.*)?$/);
    if (!m) continue;
    values[m[1]] = unquoteTomlString(m[2].trim());
  }
  return values;
}

function isD1Header(line: string): boolean {
  return /^\s*\[\[\s*d1_databases\s*\]\]\s*(?:#.*)?$/.test(line);
}

function isTomlHeader(line: string): boolean {
  return /^\s*\[+[^[]+?\]+\s*(?:#.*)?$/.test(line);
}

function unquoteTomlString(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function d1QuerySucceeded(json: { success?: boolean; result?: unknown; errors?: unknown }): boolean {
  if (!json.success) return false;
  if (Array.isArray(json.result)) {
    return json.result.every((row) => {
      if (!row || typeof row !== "object") return true;
      return (row as { success?: boolean }).success !== false;
    });
  }
  if (json.result && typeof json.result === "object") {
    return (json.result as { success?: boolean }).success !== false;
  }
  return true;
}

function cfErrorMessage(json: { errors?: unknown; raw?: string }, fallback: string): string {
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    return json.errors
      .map((e) => {
        if (e && typeof e === "object" && "message" in e) {
          return String((e as { message?: unknown }).message);
        }
        return JSON.stringify(e);
      })
      .join("; ");
  }
  if (typeof json.raw === "string" && json.raw.trim()) return json.raw.trim();
  return fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
