import type { TranslateFn } from "../i18n";
import type { PlaygroundSessionFlags } from "./playground-session";
import { getPlaygroundSourceLabels } from "../i18n/playground-ui";

export type FieldSource = "env" | "cf" | "wrangler" | "catalog" | "derived";

export interface FieldMetaSlice {
  source: FieldSource;
  key?: string;
  hint?: string;
}

export type PlaygroundFields = Record<string, FieldMetaSlice | undefined>;

export interface PlaygroundDataView {
  routingSection: "cf" | "worker";
  showGatewayContext: boolean;
  showRoutingMismatch: boolean;
  controls: {
    gateway?: FieldMetaSlice;
    model: FieldMetaSlice;
    request: FieldMetaSlice;
    workerUrl?: FieldMetaSlice;
    supabaseUrl?: FieldMetaSlice;
  };
  summary: Array<{ label: string; meta: FieldMetaSlice }>;
}

const FALLBACK: Record<FieldSource, FieldMetaSlice> = {
  env: { source: "env" },
  cf: { source: "cf" },
  wrangler: { source: "wrangler" },
  catalog: { source: "catalog" },
  derived: { source: "derived" },
};

function pick(fields: PlaygroundFields, key: string, fallback: FieldMetaSlice): FieldMetaSlice {
  return fields[key] ?? fallback;
}

export function resolvePlaygroundDataView(
  inspectTarget: "gateway" | "worker",
  flags: PlaygroundSessionFlags,
  fields: PlaygroundFields,
  t: TranslateFn,
): PlaygroundDataView {
  const labels = getPlaygroundSourceLabels(t);

  if (inspectTarget === "gateway") {
    const model = pick(fields, "models", { source: "env", key: "MODEL_CATALOG" });
    const request = pick(fields, "chat.authorization", FALLBACK.env);
    return {
      routingSection: "cf",
      showGatewayContext: true,
      showRoutingMismatch: false,
      controls: {
        gateway: pick(fields, "gateways", FALLBACK.cf),
        model,
        request,
      },
      summary: [
        { label: labels.model, meta: model },
        { label: labels.routing, meta: pick(fields, "gateway", FALLBACK.cf) },
        { label: labels.auth, meta: request },
      ],
    };
  }

  if (flags.useWorkerToml) {
    const gateway = pick(fields, "worker_routing.gateway", FALLBACK.wrangler);
    const model = pick(fields, "worker_routing.default_model", FALLBACK.wrangler);
    const request = pick(fields, "worker.authorization", FALLBACK.derived);
    return {
      routingSection: "worker",
      showGatewayContext: false,
      showRoutingMismatch: false,
      controls: {
        gateway,
        model,
        request,
        workerUrl: fields["worker.url"],
        supabaseUrl: fields["worker.supabase_url"],
      },
      summary: [
        { label: labels.gateway, meta: gateway },
        { label: labels.model, meta: model },
        { label: labels.auth, meta: request },
      ],
    };
  }

  const model = pick(fields, "models", { source: "env", key: "MODEL_CATALOG" });
  const request = pick(fields, "worker.authorization", FALLBACK.derived);
  return {
    routingSection: "cf",
    showGatewayContext: true,
    showRoutingMismatch: true,
    controls: {
      gateway: pick(fields, "gateways", FALLBACK.cf),
      model,
      request,
      workerUrl: fields["worker.url"],
      supabaseUrl: fields["worker.supabase_url"],
    },
    summary: [
      { label: labels.model, meta: model },
      { label: labels.routingCompare, meta: pick(fields, "gateway", FALLBACK.cf) },
      { label: labels.auth, meta: request },
    ],
  };
}
