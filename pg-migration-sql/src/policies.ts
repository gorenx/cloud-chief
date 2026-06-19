import { normalizeTableName } from "./fallback";

export interface ParsedPolicy {
  name: string;
  table: string;
}

const CREATE_POLICY_RE =
  /create\s+policy\s+(?:"([^"]+)"|'([^']+)'|([\w.-]+))\s+on\s+(?:(?:public|auth)\.)?"?([\w.-]+)"?/gi;

/** Parse `CREATE POLICY` names and target tables from migration SQL. */
export function parsePoliciesFromSql(sql: string): ParsedPolicy[] {
  const out: ParsedPolicy[] = [];
  let match: RegExpExecArray | null;
  CREATE_POLICY_RE.lastIndex = 0;
  while ((match = CREATE_POLICY_RE.exec(sql)) !== null) {
    const name = (match[1] || match[2] || match[3] || "").trim();
    const table = normalizeTableName(match[4]);
    if (!name || !table) continue;
    out.push({ name, table });
  }
  return out;
}

export function policiesForTable(sql: string, tableName: string): string[] {
  const table = tableName.toLowerCase();
  const names = new Set<string>();
  for (const policy of parsePoliciesFromSql(sql)) {
    if (policy.table === table) names.add(policy.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
