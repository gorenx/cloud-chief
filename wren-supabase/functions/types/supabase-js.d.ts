// Minimal typings for Edge Functions — satisfies the IDE without npm install.
// Runtime resolves via deno.json → esm.sh (see import_map.json for deploy).

declare module "@supabase/supabase-js" {
  type DbError = { code?: string; message?: string };

  type PostgrestBuilder = PromiseLike<{ data: any; error: DbError | null }> & {
    eq(column: string, value: string | number): PostgrestBuilder;
    select(columns: string): PostgrestBuilder;
    maybeSingle(): PromiseLike<{ data: any; error: DbError | null }>;
  };

  type PostgrestTable = {
    select(columns: string): PostgrestBuilder;
    insert(row: Record<string, unknown>): PostgrestBuilder;
    update(patch: Record<string, unknown>): PostgrestBuilder;
    upsert(
      row: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): PostgrestBuilder;
  };

  export interface SupabaseClient {
    from(table: string): PostgrestTable;
    auth: {
      getUser(): Promise<{
        data: { user: { id: string } | null };
        error: DbError | null;
      }>;
    };
  }

  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): SupabaseClient;
}
