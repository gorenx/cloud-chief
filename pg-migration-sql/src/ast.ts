import type { AST, Create } from "node-sql-parser";
import { addTableName } from "./fallback";

export function addTableRef(out: Set<string>, tableRef: unknown): void {
  if (!tableRef) return;
  if (Array.isArray(tableRef)) {
    for (const item of tableRef) addTableRef(out, item);
    return;
  }
  if (typeof tableRef === "object" && tableRef !== null && "table" in tableRef) {
    addTableName(out, String((tableRef as { table: string }).table));
  }
}

export function tablesFromTableList(entries: string[], allowedTypes?: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const entry of entries) {
    const parts = entry.split("::");
    if (parts.length < 3) continue;
    const type = parts[0]?.toLowerCase();
    if (allowedTypes && type && !allowedTypes.has(type)) continue;
    addTableName(out, parts[parts.length - 1]);
  }
  return out;
}

export function collectCreateTablesFromAst(ast: AST[] | AST, out: Set<string>): void {
  const nodes = Array.isArray(ast) ? ast : [ast];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "create" && (node as Create).keyword === "table") {
      addTableRef(out, (node as Create).table);
    }
  }
}
