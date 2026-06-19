export function normalizeTableName(name: string): string {
  return name.replace(/^"+|"+$/g, "").toLowerCase();
}

export function addTableName(out: Set<string>, name: string | null | undefined): void {
  if (!name) return;
  const normalized = normalizeTableName(name);
  if (normalized) out.add(normalized);
}

const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?("?)([a-zA-Z_][\w]*)\1/gi;

export function regexCreateTables(sql: string, out: Set<string>): void {
  let match: RegExpExecArray | null;
  CREATE_TABLE_RE.lastIndex = 0;
  while ((match = CREATE_TABLE_RE.exec(sql)) !== null) {
    addTableName(out, match[2]);
  }
}

export function tableRefPatterns(table: string): RegExp[] {
  const quoted = `(?:(?:public|auth)\\.)?"?${table}"?`;
  return [
    new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${quoted}\\b`, "i"),
    new RegExp(`alter\\s+table\\s+${quoted}\\b`, "i"),
    new RegExp(`\\bon\\s+${quoted}\\b`, "i"),
    new RegExp(`grant\\s+.+\\s+on\\s+${quoted}\\b`, "i"),
    new RegExp(`create\\s+(?:unique\\s+)?index\\s+.+\\s+on\\s+${quoted}\\b`, "i"),
    new RegExp(`comment\\s+on\\s+table\\s+${quoted}\\b`, "i"),
  ];
}

export function regexStatementReferencesTable(statement: string, tableName: string): boolean {
  const table = tableName.toLowerCase();
  return tableRefPatterns(table).some((pattern) => pattern.test(statement));
}
