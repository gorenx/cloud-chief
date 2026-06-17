import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { adminFetch, fetchState } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { Link } from "react-router-dom";

export function ProvidersPage() {
  const { token } = useAdminToken();
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await adminFetch(token, "POST", "/admin/providers", {
        slug: slug.trim(),
        base_url: baseUrl.trim(),
        name: slug.trim(),
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("提供商已保存");
      setSlug("");
      setBaseUrl("");
      void qc.invalidateQueries({ queryKey: ["state"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await adminFetch(token, "DELETE", `/admin/providers?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("已删除");
      void qc.invalidateQueries({ queryKey: ["state"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        请先在 <Link to="/settings" className="text-[var(--color-accent)]">设置</Link> 配置令牌。
      </p>
    );
  }

  const list = stateQ.data?.providers ?? [];

  useEffect(() => {
    const d = stateQ.data?.defaults;
    if (!d) return;
    if (!slug && d.provider_slug) setSlug(d.provider_slug);
    if (!baseUrl && d.base_url) setBaseUrl(d.base_url);
  }, [stateQ.data?.defaults, slug, baseUrl]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">自定义提供商</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          第 2 步：注册上游（如阿里云 MaaS），slug 会出现在 URL 的 custom- 后面
        </p>
      </div>

      <GatewaySetupFlow current="provider" collapsible />

      <Card>
        <CardTitle>提供商列表</CardTitle>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">暂无提供商</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="pb-2">slug</th>
                <th className="pb-2">base_url</th>
                <th className="pb-2">启用</th>
                <th className="pb-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)]/60">
                  <td className="py-3">
                    <code className="mono">{p.slug}</code>
                  </td>
                  <td className="py-3 text-[var(--color-muted)]">{p.base_url}</td>
                  <td className="py-3">
                    <Chip variant={p.enable ? "on" : "off"}>{p.enable ? "是" : "否"}</Chip>
                  </td>
                  <td className="py-3">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(`确认删除提供商 ${p.slug}？`)) delMut.mutate(p.id);
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
        <CardTitle>创建 / 更新</CardTitle>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          base_url 只填根域名，不带路径
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="qwen-beijing-maas" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">base_url</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://xxx.maas.aliyuncs.com"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!slug.trim() || !baseUrl.trim() || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          创建 / 更新
        </Button>
      </Card>
    </div>
  );
}
