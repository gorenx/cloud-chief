import type { FieldMetaEntry, RoutingInfo } from "@/types";
import { FieldLabel } from "./SourceBadge";
import { InvokeUrlCopy } from "./InvokeUrlCopy";
import { Chip } from "./ui/Chip";

export function RoutingFieldList({
  routing,
  gateway,
  fields,
}: {
  routing: RoutingInfo;
  gateway: string;
  fields: Record<string, FieldMetaEntry>;
}) {
  const upstreamBase = routing.base_url || routing.provider?.base_url || "";

  return (
    <div className="space-y-3 text-sm">
      <div>
        <FieldLabel label="invoke_url" meta={fields["routing.invoke_url"]} />
        <div className="mt-1">
          <InvokeUrlCopy url={routing.invoke_url} />
        </div>
      </div>
      <div className="grid gap-2">
        <div>
          <FieldLabel label="gateway" meta={fields.gateway} />
          <div className="mono mt-0.5">{gateway || "—"}</div>
        </div>
        <div>
          <FieldLabel label="provider_slug" meta={fields["routing.provider_slug"]} />
          <div className="mono mt-0.5">{routing.provider_slug || "—"}</div>
        </div>
        <div>
          <FieldLabel label="API path" meta={fields["routing.path"]} />
          <div className="mono mt-0.5 break-all">{routing.path || "—"}</div>
        </div>
        <div>
          <FieldLabel label="上游 base_url" meta={fields["routing.base_url"]} />
          <div className="mono mt-0.5 break-all">{upstreamBase || "—"}</div>
        </div>
        {routing.provider && (
          <div>
            <FieldLabel label="CF 自定义提供商" meta={fields["routing.provider"]} />
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
