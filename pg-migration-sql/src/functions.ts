const CREATE_ROUTINE_RE =
  /create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(?:(?:public)\.)?"?([a-zA-Z_][\w]*)"?\s*\(/gi;

const ROUTINE_HEADER_RE = (name: string) =>
  new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?(?:function|procedure)\\s+(?:(?:public)\\.)?"?${name}"?\\s*\\(`,
    "i",
  );

const ROUTINE_PERM_RE = (name: string) =>
  new RegExp(
    `(?:revoke|grant)\\s+[\\s\\S]*?\\b(?:function|procedure)\\s+(?:(?:public)\\.)?"?${name}"?\\s*\\([\\s\\S]*?;`,
    "gi",
  );

function normalizeRoutineName(name: string): string {
  return name.replace(/^"+|"+$/g, "").toLowerCase();
}

/** List `CREATE FUNCTION` / `CREATE PROCEDURE` targets in migration SQL (public schema). */
export function parseFunctionsFromSql(sql: string): string[] {
  const names = new Set<string>();
  CREATE_ROUTINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CREATE_ROUTINE_RE.exec(sql)) !== null) {
    const normalized = normalizeRoutineName(match[1]);
    if (normalized) names.add(normalized);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Extract CREATE + GRANT/REVOKE statements for one routine from a migration script. */
export function extractFunctionSql(sql: string, functionName: string): string {
  const fn = normalizeRoutineName(functionName);
  const header = ROUTINE_HEADER_RE(fn);
  const startMatch = header.exec(sql);
  if (!startMatch) return "";

  const start = startMatch.index;
  const afterCreate = sql.slice(start);
  const bodyMatch = afterCreate.match(/as\s+\$\$[\s\S]*?\$\$;/i);
  if (!bodyMatch) return "";

  const chunks: string[] = [];
  const funcEnd = bodyMatch.index! + bodyMatch[0].length;
  chunks.push(afterCreate.slice(0, funcEnd).trim());

  const permRe = ROUTINE_PERM_RE(fn);
  permRe.lastIndex = 0;
  let perm: RegExpExecArray | null;
  while ((perm = permRe.exec(sql)) !== null) {
    chunks.push(perm[0].trim());
  }

  return chunks.join("\n\n");
}

export function extractFunctionSqlFromSources(
  sources: Array<{ sql: string }>,
  functionName: string,
): string | null {
  const chunks: string[] = [];
  for (const source of sources) {
    const extracted = extractFunctionSql(source.sql, functionName);
    if (extracted) chunks.push(extracted);
  }
  return chunks.length > 0 ? chunks.join("\n\n") : null;
}
