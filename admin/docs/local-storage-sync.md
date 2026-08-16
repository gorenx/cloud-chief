# Local storage and synchronization

English | [简体中文](local-storage-sync.zh-CN.md)

SQLite gives the Admin application durable preferences, searchable remote snapshots, synchronization history, and operation audit data without pretending to own Cloudflare or Supabase resources.

## Ownership rules

- Local authority: Admin preferences, selected defaults, project indexes, sync runs, and operation events.
- Remote authority: Cloudflare gateways/providers/keys/D1/Workers and Supabase organizations/projects.
- File authority: each Worker's `wrangler.toml` and `.dev.vars`.

## Synchronization

1. Startup opens and migrates the local database, seeds missing preferences, indexes Worker projects, and schedules or performs configured refreshes.
2. Reads use the latest successful snapshot and expose freshness/error metadata.
3. Explicit refresh calls the owning remote API and atomically replaces that domain's snapshot.
4. Mutations are sent to the authoritative system first; after success, the affected domain is refreshed or updated from the confirmed response.
5. File changes are written atomically and then re-read before SQLite metadata is updated.

## Conflict and failure rules

- Remote and file authority win over stale snapshots.
- Local preferences are never replaced by a remote refresh.
- A failed refresh preserves the last successful snapshot and records the failure.
- Secrets are write-only from the UI; persisted metadata must remain redacted.
- Concurrent synchronization for the same domain is serialized and recorded as one run.

Schema and implementation references are documented in the Chinese companion until the implementation inventory is moved to a generated reference; the rules above are the stable contract for both languages.
