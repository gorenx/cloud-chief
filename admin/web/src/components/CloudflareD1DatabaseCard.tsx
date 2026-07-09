import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { toast } from "sonner";
import { bindCloudflareD1Database, createCloudflareD1Database } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { WorkerD1BindResponse, WorkerD1CreateResponse, WorkerStatus } from "@/types";

const DEFAULT_DATABASE_NAME = "cloud-chief-auth";
const DEFAULT_BINDING = "DB";

export function CloudflareD1DatabaseCard({
  token,
  workerDir,
  status,
  onCreated,
}: {
  token: string;
  workerDir: string;
  status: WorkerStatus | undefined;
  onCreated: () => void;
}) {
  const { t, displayError } = useLocale();
  const current = useMemo(
    () => status?.d1_databases.find((db) => db.binding === DEFAULT_BINDING) ?? status?.d1_databases[0] ?? null,
    [status?.d1_databases],
  );
  const migrationCount = status?.d1_migrations.length ?? 0;
  const [databaseName, setDatabaseName] = useState(current?.database_name ?? DEFAULT_DATABASE_NAME);
  const [databaseId, setDatabaseId] = useState(current?.database_id ?? "");
  const [binding, setBinding] = useState(current?.binding ?? DEFAULT_BINDING);
  const [applyMigrations, setApplyMigrations] = useState(migrationCount > 0);

  useEffect(() => {
    if (!databaseId.trim()) {
      setDatabaseName(current?.database_name ?? DEFAULT_DATABASE_NAME);
      setDatabaseId(current?.database_id ?? "");
    }
    setBinding(current?.binding ?? DEFAULT_BINDING);
    setApplyMigrations(migrationCount > 0);
  }, [current?.binding, current?.database_id, current?.database_name, migrationCount, workerDir]);

  const create = useMutation({
    mutationFn: async () => {
      const r = await createCloudflareD1Database(
        token,
        {
          name: databaseName.trim(),
          binding: binding.trim(),
          update_wrangler: true,
          apply_migrations: applyMigrations,
        },
        workerDir || undefined,
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data: WorkerD1CreateResponse) => {
      const count = data.migrations.applied.length;
      setDatabaseName(data.database.name);
      setDatabaseId(data.database.id);
      toast.success(
        count > 0
          ? t("cloudflareDb.toast.createdWithMigrations", { count })
          : t("cloudflareDb.toast.created"),
      );
      onCreated();
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const bind = useMutation({
    mutationFn: async () => {
      const r = await bindCloudflareD1Database(
        token,
        {
          database_name: databaseName.trim(),
          database_id: databaseId.trim(),
          binding: binding.trim(),
          apply_migrations: applyMigrations,
        },
        workerDir || undefined,
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data: WorkerD1BindResponse) => {
      const count = data.migrations.applied.length;
      toast.success(
        count > 0
          ? t("cloudflareDb.toast.boundWithMigrations", { count })
          : t("cloudflareDb.toast.bound"),
      );
      onCreated();
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const canCreate =
    Boolean(status) &&
    databaseName.trim().length > 0 &&
    binding.trim().length > 0 &&
    !bind.isPending &&
    !create.isPending;
  const canBind =
    Boolean(status) &&
    databaseName.trim().length > 0 &&
    databaseId.trim().length > 0 &&
    binding.trim().length > 0 &&
    !create.isPending &&
    !bind.isPending;

  return (
    <Card>
      <CardTitle desc={t("cloudflareDb.card.create.desc")}>
        {t("cloudflareDb.card.create.title")}
      </CardTitle>

      {current && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/40 p-3 text-xs">
          <div className="font-medium text-[var(--color-text)]">
            {t("cloudflareDb.currentBinding")}
          </div>
          <div className="mono mt-1 space-y-1 break-all text-[var(--color-muted)]">
            <div>
              {current.binding} → {current.database_name}
            </div>
            <div>{current.database_id}</div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            {t("cloudflareDb.databaseName")}
          </span>
          <Input
            value={databaseName}
            onChange={(e) => setDatabaseName(e.target.value)}
            placeholder={DEFAULT_DATABASE_NAME}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            {t("cloudflareDb.binding")}
          </span>
          <Input value={binding} onChange={(e) => setBinding(e.target.value.toUpperCase())} />
        </label>
      </div>

      <label className="mt-3 block min-w-0">
        <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
          {t("cloudflareDb.databaseId")}
        </span>
        <Input
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          placeholder={t("cloudflareDb.databaseIdPlaceholder")}
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-muted)]">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
          checked={applyMigrations}
          disabled={migrationCount === 0}
          onChange={(e) => setApplyMigrations(e.target.checked)}
        />
        <span>
          {migrationCount > 0
            ? t("cloudflareDb.applyMigrations", { count: migrationCount })
            : t("cloudflareDb.noMigrations")}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => create.mutate()} disabled={!canCreate}>
          <Database className="mr-1.5 size-4" aria-hidden="true" />
          {create.isPending ? t("cloudflareDb.creating") : t("cloudflareDb.create")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => bind.mutate()} disabled={!canBind}>
          {bind.isPending ? t("cloudflareDb.bindingWriting") : t("cloudflareDb.writeBinding")}
        </Button>
        {create.data?.database.id && (
          <code className="mono max-w-full break-all text-xs text-[var(--color-muted)]">
            database_id = "{create.data.database.id}"
          </code>
        )}
      </div>
    </Card>
  );
}
