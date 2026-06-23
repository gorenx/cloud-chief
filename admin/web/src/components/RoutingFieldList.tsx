import type { FieldMetaEntry } from "@/types";
import { useT } from "@/contexts/LocaleContext";
import { FieldLabel } from "./SourceBadge";
import { InvokeUrlCopy } from "./InvokeUrlCopy";
import { Chip } from "./ui/Chip";

export interface RoutingFieldValues {
  invoke_url: string;
  gateway: string;
  provider_slug: string;
  path: string;
  base_url: string;
  provider?: { slug: string; base_url: string; enable?: boolean } | null;
  account_id?: string;
  default_model?: string | null;
  free_model?: string | null;
  plus_model?: string | null;
}

export function RoutingFieldList({
  section,
  routing,
  fields,
  fieldPrefix,
}: {
  section: "cf" | "worker";
  routing: RoutingFieldValues;
  fields: Record<string, FieldMetaEntry>;
  fieldPrefix: "routing" | "worker_routing";
}) {
  const t = useT();
  const upstreamBase = routing.base_url || routing.provider?.base_url || "";

  return (
    <div className="space-y-3 text-sm">
      <div>
        <FieldLabel label="invoke_url" meta={fields[`${fieldPrefix}.invoke_url`]} />
        <div className="mt-1">
          <InvokeUrlCopy url={routing.invoke_url} />
        </div>
      </div>
      <div className="grid gap-2">
        {routing.account_id !== undefined && (
          <div>
            <FieldLabel label="account_id" meta={fields["worker_routing.account_id"]} />
            <div className="mono mt-0.5 break-all">{routing.account_id || "—"}</div>
          </div>
        )}
        <div>
          <FieldLabel
            label="gateway"
            meta={section === "cf" ? fields.gateway : fields["worker_routing.gateway"]}
          />
          <div className="mono mt-0.5">{routing.gateway || "—"}</div>
        </div>
        <div>
          <FieldLabel
            label="provider_slug"
            meta={
              section === "cf"
                ? fields["routing.provider_slug"]
                : fields["worker_routing.provider_slug"]
            }
          />
          <div className="mono mt-0.5">{routing.provider_slug || "—"}</div>
        </div>
        {section === "worker" && (
          <>
            <div>
              <FieldLabel label="FREE_MODEL" meta={fields["worker_routing.free_model"]} />
              <div className="mono mt-0.5">{routing.free_model || routing.default_model || "—"}</div>
            </div>
            <div>
              <FieldLabel label="PLUS_MODEL" meta={fields["worker_routing.plus_model"]} />
              <div className="mono mt-0.5">{routing.plus_model || "—"}</div>
            </div>
            <div>
              <FieldLabel label="DEFAULT_MODEL" meta={fields["worker_routing.default_model"]} />
              <div className="mono mt-0.5 text-[var(--color-muted)]">{routing.default_model || "—"}</div>
            </div>
          </>
        )}
        <div>
          <FieldLabel label="API path" meta={fields[`${fieldPrefix}.path`]} />
          <div className="mono mt-0.5 break-all">{routing.path || "—"}</div>
        </div>
        <div>
          <FieldLabel
            label={t("routing.baseUrlLabel")}
            meta={
              section === "cf"
                ? fields["routing.base_url"]
                : fields["worker_routing.base_url"]
            }
          />
          <div className="mono mt-0.5 break-all">{upstreamBase || "—"}</div>
        </div>
        {routing.provider && (
          <div>
            <FieldLabel
              label={t("routing.cfProviderLabel")}
              meta={
                section === "cf"
                  ? fields["routing.provider"]
                  : fields["worker_routing.provider"]
              }
            />
            <div className="mt-0.5">
              <Chip variant={routing.provider.enable !== false ? "on" : "off"}>
                {routing.provider.slug}
              </Chip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
