# pg-migration-sql

English | [简体中文](README.zh-CN.md)

Small TypeScript utility for discovering and applying ordered PostgreSQL migration files.

```bash
pnpm install
pnpm test
```

Use the package API or scripts defined in [`package.json`](package.json). Migration files remain the authoritative schema history; do not edit an already-applied migration.
