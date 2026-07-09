import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchSupabaseFunctionsStatus,
  fetchSupabaseMigrationDirs,
  fetchSupabaseMigrationStatus,
  fetchSupabaseProjects,
  fetchSupabaseStatus,
} from "@/lib/api";
import { deriveSupabaseSetupStatus } from "@/lib/supabase-setup-flow";

function projectFromUrl(
  supabaseUrl: string | null,
  projects: Array<{ ref: string; name: string }>,
): { ref: string; name: string } | null {
  if (!supabaseUrl) return null;
  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) return null;
  const fromList = projects.find((p) => p.ref === ref);
  if (fromList) return { name: fromList.name, ref: fromList.ref };
  return { name: ref, ref };
}

export function useSupabaseSetupFlowStatus({
  token,
  supabaseUrl,
  hasAnonKey,
}: {
  token: string;
  supabaseUrl: string | null;
  hasAnonKey: boolean;
}) {
  const statusQ = useQuery({
    queryKey: ["supabase-status", token],
    queryFn: async () => {
      const r = await fetchSupabaseStatus(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const projectsQ = useQuery({
    queryKey: ["supabase-projects", token],
    queryFn: async () => {
      const r = await fetchSupabaseProjects(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && statusQ.data?.connected),
  });

  const migrationDirsQ = useQuery({
    queryKey: ["supabase-migration-dirs", token],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationDirs(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const appliedProject = useMemo(
    () => projectFromUrl(supabaseUrl, projectsQ.data?.projects ?? []),
    [supabaseUrl, projectsQ.data],
  );

  const migrationsQ = useQuery({
    queryKey: ["supabase-migrations", token, appliedProject?.ref, migrationDirsQ.data?.current],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationStatus(
        token,
        appliedProject!.ref,
        migrationDirsQ.data!.current,
      );
      if (!r.ok) {
        const err = new Error(r.error) as Error & { needsDbScope?: boolean };
        err.needsDbScope = r.needs_db_scope;
        throw err;
      }
      return r.data;
    },
    enabled: Boolean(token && appliedProject?.ref && hasAnonKey && migrationDirsQ.data?.current),
    retry: false,
  });

  const functionsQ = useQuery({
    queryKey: ["supabase-functions", token, appliedProject?.ref],
    queryFn: async () => {
      const r = await fetchSupabaseFunctionsStatus(token, appliedProject!.ref);
      if (!r.ok) {
        const err = new Error(r.error) as Error & { needsFunctionsScope?: boolean };
        err.needsFunctionsScope = r.needs_functions_scope;
        throw err;
      }
      return r.data;
    },
    enabled: Boolean(token && appliedProject?.ref && hasAnonKey),
    retry: false,
  });

  const migrationErr = migrationsQ.error as (Error & { needsDbScope?: boolean }) | null;
  const functionsErr = functionsQ.error as (Error & { needsFunctionsScope?: boolean }) | null;

  const flowStatus = useMemo(
    () =>
      deriveSupabaseSetupStatus({
        oauthConfigured: Boolean(statusQ.data?.oauth_configured),
        localOnly: Boolean(statusQ.data?.local_only),
        connected: Boolean(statusQ.data?.connected),
        supabaseUrl,
        hasAnonKey,
        projectRef: appliedProject?.ref ?? null,
        projectName: appliedProject?.name ?? null,
        projectsCount: statusQ.data?.account?.projects_count ?? projectsQ.data?.projects.length ?? 0,
        pendingMigrations: migrationsQ.data?.pending_count ?? 0,
        migrationFileCount: migrationsQ.data?.migration_files?.length ?? 0,
        pendingFunctions: functionsQ.data?.pending_count ?? 0,
        localFunctionCount: functionsQ.data?.function_summary?.local ?? 0,
        needsDbScope: Boolean(migrationErr?.needsDbScope),
        needsFunctionsScope: Boolean(functionsErr?.needsFunctionsScope),
      }),
    [
      statusQ.data,
      supabaseUrl,
      hasAnonKey,
      appliedProject,
      migrationsQ.data,
      functionsQ.data,
      migrationErr?.needsDbScope,
      functionsErr?.needsFunctionsScope,
      projectsQ.data?.projects.length,
    ],
  );

  return { flowStatus, statusQ, projectsQ, migrationDirsQ, migrationsQ, functionsQ };
}
