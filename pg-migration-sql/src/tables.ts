import { collectCreateTablesFromAst, tablesFromTableList } from "./ast";
import { addTableName, regexCreateTables, regexStatementReferencesTable } from "./fallback";
import { pgParser, PG_PARSE_OPT } from "./parser";
import { splitSqlStatements } from "./statements";

function tablesReferencedInStatement(statement: string): Set<string> {
  const out = new Set<string>();

  try {
    for (const entry of pgParser.tableList(statement, PG_PARSE_OPT)) {
      for (const name of tablesFromTableList([entry])) out.add(name);
    }
    const ast = pgParser.astify(statement, PG_PARSE_OPT);
    collectCreateTablesFromAst(ast, out);
  } catch {
    regexCreateTables(statement, out);
  }

  if (out.size === 0) {
    regexCreateTables(statement, out);
  }

  return out;
}

/** List `CREATE TABLE` targets in migration SQL (public/auth schemas). */
export function parseTablesFromSql(sql: string): string[] {
  const tables = new Set<string>();

  try {
    const parsed = pgParser.parse(sql, PG_PARSE_OPT);
    for (const name of tablesFromTableList(parsed.tableList, new Set(["create"]))) {
      tables.add(name);
    }
    collectCreateTablesFromAst(parsed.ast, tables);
  } catch {
    try {
      const ast = pgParser.astify(sql, PG_PARSE_OPT);
      collectCreateTablesFromAst(ast, tables);
      for (const name of tablesFromTableList(pgParser.tableList(sql, PG_PARSE_OPT), new Set(["create"]))) {
        tables.add(name);
      }
    } catch {
      /* regex fallback below */
    }
  }

  regexCreateTables(sql, tables);
  return [...tables].sort((a, b) => a.localeCompare(b));
}

/** Whether a single statement touches the given table (parser + Postgres DDL fallback). */
export function statementReferencesTable(statement: string, tableName: string): boolean {
  const table = tableName.toLowerCase();
  if (tablesReferencedInStatement(statement).has(table)) return true;
  return regexStatementReferencesTable(statement, table);
}

/** Extract statements that belong to one table from a migration script. */
export function extractTableSql(sql: string, tableName: string): string {
  const parts = splitSqlStatements(sql)
    .filter((stmt) => statementReferencesTable(stmt, tableName))
    .map((stmt) => (stmt.endsWith(";") ? stmt : `${stmt};`));
  return parts.join("\n\n");
}

/** Merge per-table SQL from multiple migration sources. */
export function extractTableSqlFromSources(
  sources: Array<{ sql: string }>,
  tableName: string,
): string | null {
  const chunks: string[] = [];
  for (const source of sources) {
    const extracted = extractTableSql(source.sql, tableName);
    if (extracted) chunks.push(extracted);
  }
  return chunks.length > 0 ? chunks.join("\n\n") : null;
}
