export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql.replace(/--[^\n]*/g, "");
  return withoutComments
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}
