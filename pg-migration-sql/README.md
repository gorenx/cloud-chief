# pg-migration-sql

PostgreSQL 迁移 SQL 解析模块（与 Supabase / Admin 解耦）。

## 能力

- `splitSqlStatements` — 按语句拆分 SQL 脚本
- `parseTablesFromSql` — 从脚本中解析 `CREATE TABLE` 涉及的表名
- `statementReferencesTable` — 判断单条语句是否作用于某张表
- `extractTableSql` — 从脚本中提取某张表相关的 DDL（含 RLS / policy 等，parser 不支持时走正则兜底）
- `extractTableSqlFromSources` — 从多份迁移源合并某张表的 SQL

基于 [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser)（`database: Postgresql`）。

## 使用

```typescript
import { parseTablesFromSql, extractTableSql } from "pg-migration-sql";

const tables = parseTablesFromSql(migrationSql);
const ddl = extractTableSql(migrationSql, "profiles");
```

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
```
