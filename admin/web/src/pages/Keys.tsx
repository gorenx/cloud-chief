import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import {
  adminFetch,
  fetchGatewayContext,
  fetchKeys,
  fetchState,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { ModelDetailCard } from "@/components/ModelDetailCard";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import type { ByokKey } from "@/types";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";

export function KeysPage() {
  const { token } = useAdminToken();
  const qc = useQueryClient();
  const [gateway, setGateway] = useState("");
  const [slugManual, setSlugManual] = useState("");
  const [alias, setAlias] = useState("default");
  const [secret, setSecret] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [slugSel, setSlugSel] = useState("");
  const [slugManualFocused, setSlugManualFocused] = useState(false);

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const keysQ = useQuery({
    queryKey: ["keys", token, gateway],
    queryFn: async () => {
      const r = await fetchKeys(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return (r.data.result ?? []) as ByokKey[];
    },
    enabled: Boolean(token && gateway),
  });

  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, gateway],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && gateway),
  });

  const providers = stateQ.data?.providers ?? [];
  const gateways = stateQ.data?.gateways ?? [];

  useEffect(() => {
    if (!gateway && stateQ.data?.defaults.gateway) {
      const id = stateQ.data.defaults.gateway;
      if (gateways.some((g) => g.id === id)) setGateway(id);
    }
  }, [gateway, gateways, stateQ.data?.defaults.gateway]);

  useEffect(() => {
    if (!slugSel && stateQ.data?.defaults.provider_slug) {
      const slug = stateQ.data.defaults.provider_slug;
      if (providers.some((p) => p.slug === slug)) setSlugSel(slug);
    }
  }, [slugSel, providers, stateQ.data?.defaults.provider_slug]);

  const effectiveSlug = slugManual.trim() || slugSel;
  const slugMatch =
    effectiveSlug && providers.some((p) => p.slug === effectiveSlug);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!slugMatch && effectiveSlug) {
        if (
          !confirm(
            `slug "${effectiveSlug}" 不在提供商列表中，BYOK 可能不生效。继续？`,
          )
        ) {
          throw new Error("已取消");
        }
      }
      const r = await adminFetch(token, "POST", "/admin/keys", {
        gateway,
        provider_slug: effectiveSlug,
        alias: alias.trim() || "default",
        default_config: isDefault,
        secret: secret.trim(),
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("密钥已保存");
      setSecret("");
      setSlugManual("");
      void qc.invalidateQueries({ queryKey: ["keys"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
    },
    onError: (e) => {
      const msg = String(e);
      if (msg.includes("Secrets Store")) {
        toast.error("API Token 缺少 Secrets Store Edit 权限");
      } else if (msg !== "已取消") {
        toast.error(msg);
      }
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await adminFetch(
        token,
        "DELETE",
        `/admin/keys?gateway=${encodeURIComponent(gateway)}&id=${encodeURIComponent(id)}`,
      );
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("已删除");
      void qc.invalidateQueries({ queryKey: ["keys"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        请先在{" "}
        <Link to="/settings" className="text-[var(--color-accent)]">
          设置
        </Link>{" "}
        配置令牌。
      </p>
    );
  }

  const d = stateQ.data?.defaults;
  const guideGateway = gateway || d?.gateway || "";
  const guideSlug = effectiveSlug || d?.provider_slug || "";
  const byokForGateway = (keysQ.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">BYOK 存储密钥</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          可选：将上游 API Key 存入 Cloudflare；不配置时可用 .env 的 DASHSCOPE_API_KEY
        </p>
      </div>

      <GatewaySetupFlow
        current="byok"
        collapsible
        callGuide={
          d
            ? {
                gatewayId: guideGateway,
                providerSlug: guideSlug,
                model: ctxQ.data?.routing.model ?? d.model,
                byokConfigured: byokForGateway,
                gatewayAuthenticated:
                  ctxQ.data?.gateway?.authentication ??
                  gateways.find((g) => g.id === guideGateway)?.authentication,
              }
            : undefined
        }
      />

      <Card>
        <label className="mb-1 block text-xs text-[var(--color-muted)]">
          选择网关
        </label>
        <Select
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          className="max-w-xs"
        >
          <option value="">— 选择网关 —</option>
          {gateways.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id}
              {g.authentication ? "（已鉴权）" : "（未鉴权）"}
            </option>
          ))}
        </Select>
      </Card>

      {ctxQ.data && (
        <div className="max-w-xl">
          <ModelDetailCard
            modelId={ctxQ.data.routing.model}
            modelMeta={ctxQ.data.model_meta}
            routing={ctxQ.data.routing}
            compact
          />
        </div>
      )}

      <Card>
        <CardTitle>密钥列表</CardTitle>
        {!gateway ? (
          <p className="text-sm text-[var(--color-muted)]">请选择网关</p>
        ) : keysQ.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">加载中…</p>
        ) : (keysQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            该网关暂无 BYOK 密钥
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="pb-2">provider_slug</th>
                <th className="pb-2">alias</th>
                <th className="pb-2">默认</th>
                <th className="pb-2">预览</th>
                <th className="pb-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {keysQ.data!.map((k) => (
                <tr
                  key={k.id}
                  className="border-b border-[var(--color-border)]/60"
                >
                  <td className="py-2">
                    <code className="mono">{k.provider_slug}</code>
                  </td>
                  <td className="py-2">{k.alias}</td>
                  <td className="py-2">
                    {k.default_config && <Chip variant="on">默认</Chip>}
                  </td>
                  <td className="py-2 text-xs text-[var(--color-muted)]">
                    {k.secret_preview}
                  </td>
                  <td className="py-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm("确认删除该密钥？")) delMut.mutate(k.id);
                      }}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <CardTitle>添加密钥</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              provider_slug
            </label>
            <Select
              value={slugSel}
              onChange={(e) => setSlugSel(e.target.value)}
            >
              {providers.length === 0 ? (
                <option value="">（暂无提供商）</option>
              ) : (
                providers.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.slug}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              手动 slug（可选）
            </label>
            <Input
              value={slugManual}
              onChange={(e) => setSlugManual(e.target.value)}
              onFocus={() => setSlugManualFocused(true)}
              onBlur={() => setSlugManualFocused(false)}
              placeholder="仅在列表里没有时填"
              className={
                slugManualFocused
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/25"
                  : undefined
              }
            />
            {slugManualFocused && (
              <div
                role="note"
                className="mt-2 flex gap-2.5 rounded-lg border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 px-3 py-2.5 shadow-sm"
              >
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-[var(--color-text)]">
                  <span className="font-medium text-[var(--color-accent)]">
                    手动 slug 说明
                  </span>
                  ：仅在左侧下拉没有目标提供商时填写；填写后
                  <span className="font-semibold">优先于下拉</span>
                  。须与自定义提供商 slug 完全一致，即请求 URL 中{" "}
                  <code className="mono rounded bg-black/30 px-1 py-0.5 text-[var(--color-accent)]">
                    custom-
                  </code>{" "}
                  后面的部分（如{" "}
                  <code className="mono font-medium">qwen-beijing-maas</code>
                  ）。
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              alias
            </label>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              密钥值
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>
        {effectiveSlug && (
          <p
            className={`mt-2 text-xs ${slugMatch ? "text-emerald-400" : "text-amber-400"}`}
          >
            {slugMatch
              ? `✓ slug 匹配，请求使用 custom-${effectiveSlug}`
              : `⚠ slug 不在提供商列表中`}
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          设为默认
        </label>
        <Button
          className="mt-4"
          disabled={
            !gateway || !effectiveSlug || !secret.trim() || saveMut.isPending
          }
          onClick={() => saveMut.mutate()}
        >
          添加密钥
        </Button>
      </Card>
    </div>
  );
}
