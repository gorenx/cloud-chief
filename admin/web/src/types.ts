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

export interface GatewayContext {
  gateway: Gateway | null;
  gateway_error: unknown;
  routing: RoutingInfo;
  keys: ByokKey[];
  keys_error: unknown;
  model_meta: ModelMeta | null;
}

export interface ByokKey {
  id: string;
  provider_slug: string;
  alias: string;
  default_config?: boolean;
  secret_preview?: string;
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
}

export interface WorkerStatus {
  worker_dir: string;
  worker_dir_rel: string;
  worker_dir_exists: boolean;
  worker_name: string | null;
  vars: Record<string, string>;
  secrets: Array<{ name: string; optional: boolean }>;
  dev_vars: Record<string, string>;
  local_secrets: string[];
  wrangler_version: string | null;
  wrangler_error: string | null;
  logged_in: boolean;
  whoami: string;
}

export interface WorkerList {
  root: string;
  default: string;
  workers: string[];
}
