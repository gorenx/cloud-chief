export interface ModelMeta {
  id: string;
  display_name: string;
  family: "max" | "plus" | "flash" | "coder" | "other";
  supports_thinking: boolean;
  notes?: string;
}

export interface Gateway {
  id: string;
  authentication?: boolean;
  collect_logs?: boolean;
  is_default?: boolean;
}

export interface Provider {
  id: string;
  slug: string;
  base_url: string;
  enable?: boolean;
}

export interface AdminState {
  account_id: string;
  has_api_token: boolean;
  defaults: {
    gateway: string;
    provider_slug: string;
    base_url: string;
    path: string;
    model: string;
  };
  gateways: Gateway[];
  gateways_error: unknown;
  providers: Provider[];
  providers_error: unknown;
}

export interface GatewayPathEntry {
  id: string;
  kind: "chat" | "responses" | "custom";
  label: string;
  suffix: string;
  invoke_url: string;
  upstream_preview?: string;
}

export interface GatewayApiPathsResponse {
  gateway_id: string;
  provider_slug: string;
  account_id: string;
  provider_base_url: string;
  chat_suffix: string;
  responses_suffix: string;
  custom_paths: string[];
  paths: GatewayPathEntry[];
}

export interface AppConfigField {
  key: string;
  value: string;
  db_value: string;
  has_value: boolean;
  in_db: boolean;
  sensitive: boolean;
  hint: string;
}

export interface AppConfigFieldReveal {
  key: string;
  value: string;
  source: "db" | "env";
  in_db: boolean;
}

export type AppConfigSectionId = "cloudflare" | "playground" | "worker" | "supabase" | "auth";

export interface AppConfigResponse {
  sections: Array<{ id: AppConfigSectionId; fields: AppConfigField[] }>;
  bootstrap_keys: string[];
  bootstrap: Record<string, string | number | boolean>;
}

export interface RoutingInfo {
  model: string;
  worker_model: string | null;
  provider_slug: string;
  provider: { slug: string; base_url: string; enable?: boolean } | null;
  path: string;
  invoke_url: string;
  api_type: "responses";
  base_url: string;
}

/** Worker 边缘代理路由（wrangler.toml [vars]） */
export interface WorkerRoutingInfo {
  account_id: string;
  gateway: string;
  provider_slug: string;
  default_model: string | null;
  free_model: string | null;
  plus_model: string | null;
  provider: { slug: string; base_url: string; enable?: boolean } | null;
  path: string;
  invoke_url: string;
  base_url: string;
  api_type: "responses";
}

export type FieldSource = "env" | "cf" | "wrangler" | "catalog" | "derived";

export interface FieldMetaEntry {
  source: FieldSource;
  key?: string;
  dependsOn?: string[];
  hint?: string;
}

export interface ResponseMeta {
  fields: Record<string, FieldMetaEntry>;
}

export interface GatewayContext {
  gateway: Gateway | null;
  gateway_error: unknown;
  routing: RoutingInfo;
  keys: ByokKey[];
  keys_error: unknown;
  model_meta: ModelMeta | null;
  _meta: ResponseMeta;
}

export interface ByokKey {
  id: string;
  provider_slug: string;
  alias: string;
  default_config?: boolean;
  secret_preview?: string;
}

export interface WorkerDebugInfo {
  capabilities: {
    uses_gateway: boolean;
    uses_model: boolean;
    supports_chat: boolean;
  };
  url: string;
  local_url: string;
  online_url: string | null;
  online_available: boolean;
  custom_domains: string[];
  url_endpoints: import("@admin/worker-endpoints").WorkerEndpointOption[];
  url_source?: "cf" | "env" | "wrangler" | "default";
  worker_name: string | null;
  supabase_url: string | null;
  default_model: string | null;
  vars_source?: "cf" | "wrangler" | "merged";
  secret_names?: string[];
  cf_error?: string | null;
  has_anon_key: boolean;
  has_test_credentials: boolean;
  endpoints: readonly string[];
}

export interface PublicConfig {
  model: string;
  gateway: string;
  gateways: string[];
  provider_slug: string;
  base_url: string;
  path: string;
  models: ModelMeta[];
  routing: RoutingInfo;
  routing_preview: string;
  worker_routing: WorkerRoutingInfo;
  worker: WorkerDebugInfo;
  /** 本次 /config 自动写入 MODEL_CATALOG 的模型 id */
  catalog_synced?: string[];
  _meta: ResponseMeta;
}

export interface WorkerCfMatch {
  matched: boolean;
  script_name: string | null;
  url: string | null;
  subdomain_enabled: boolean;
  error?: string;
}

export interface WorkerStatus {
  worker_dir: string;
  worker_dir_rel: string;
  worker_dir_exists: boolean;
  worker_name: string | null;
  compatibility_date: string | null;
  vars: Record<string, string>;
  secrets: Array<{ name: string; optional: boolean }>;
  dev_vars: Record<string, string>;
  local_secrets: string[];
  has_dev_vars: boolean;
  wrangler_version: string | null;
  wrangler_error: string | null;
  logged_in: boolean;
  whoami: string;
  cf_match?: WorkerCfMatch | null;
}

export interface WorkerListEntry {
  dir: string;
  script_name: string | null;
}

export interface WorkerList {
  root: string;
  default: string;
  workers: WorkerListEntry[];
}

export interface CfDeployedWorker {
  name: string;
  url: string | null;
  subdomain_enabled: boolean;
  vars: Record<string, string>;
  secret_names: string[];
  compatibility_date: string | null;
  usage_model: string | null;
}

export interface CfDeployedList {
  ok: boolean;
  account_subdomain: string | null;
  scripts: CfDeployedWorker[];
  error?: string;
}

export interface BuildRepoConnection {
  repo_name: string | null;
  provider_account_name: string | null;
  provider_type: string | null;
}

export interface BuildTriggerInfo {
  trigger_uuid: string;
  trigger_name: string;
  build_command: string;
  deploy_command: string;
  root_directory: string;
  branch_includes: string[];
  branch_excludes: string[];
  path_includes: string[];
  path_excludes: string[];
  is_preview: boolean;
  repo: BuildRepoConnection | null;
}

export interface BuildSummary {
  build_uuid: string;
  build_outcome: string | null;
  created_on: string | null;
  branch: string | null;
  commit_hash: string | null;
}

export interface CloudflareBuildsConfig {
  worker_name: string;
  root_directory: string;
  build_command: string;
  deploy_command: string;
  preview_deploy_command: string;
  path_includes: string[];
  path_excludes: string[];
}

export interface WorkerBuildsStatus {
  ok: boolean;
  error?: string;
  token_configured: boolean;
  account_id: string;
  wrangler_name: string | null;
  config: CloudflareBuildsConfig | null;
  worker_tag: string | null;
  cf_script_name: string | null;
  name_mismatch: boolean;
  dashboard_builds_url: string | null;
  triggers: BuildTriggerInfo[];
  recent_builds: BuildSummary[];
  token_invalid?: boolean;
}
