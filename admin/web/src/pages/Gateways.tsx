import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { adminFetch, fetchGatewayContext, fetchState } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { GatewayDetailPanel } from "@/components/GatewayDetailPanel";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function GatewaysPage() {
  const { token } = useAdminToken();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gwId, setGwId] = useState("");
  const [gwAuth, setGwAuth] = useState(true);

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, selectedId],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, selectedId!);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && selectedId),
  });

  const saveMut = useMutation({
    mutationFn: async (body: { id: string; authentication: boolean }) => {
      const r = await adminFetch(token, "POST", "/admin/gateways", body);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      toast.success("网关已保存");
      setGwId("");
      void qc.invalidateQueries({ queryKey: ["state"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, authentication }: { id: string; authentication: boolean }) => {
      const r = await adminFetch(token, "POST", "/admin/gateways", { id, authentication });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("网关已更新");
      void qc.invalidateQueries({ queryKey: ["state"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
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

  const gateways = stateQ.data?.gateways ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">网关 Gateways</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardTitle>网关列表</CardTitle>
            {gateways.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">暂无网关</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                      <th className="pb-2 pr-3">ID</th>
                      <th className="pb-2 pr-3">鉴权</th>
                      <th className="pb-2 pr-3">日志</th>
                      <th className="pb-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gateways.map((g) => (
                      <tr
                        key={g.id}
                        className={cn(
                          "border-b border-[var(--color-border)]/60 transition-colors",
                          selectedId === g.id && "bg-[var(--color-accent)]/10",
                        )}
                      >
                        <td className="py-3 pr-3">
                          <code className="mono">{g.id}</code>
                          {g.is_default && <Chip>default</Chip>}
                        </td>
                        <td className="py-3 pr-3">
                          <Chip variant={g.authentication ? "on" : "off"}>
                            {g.authentication ? "已开启" : "已关闭"}
                          </Chip>
                        </td>
                        <td className="py-3 pr-3 text-[var(--color-muted)]">
                          {g.collect_logs ? "on" : "off"}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedId(g.id)}
                            >
                              详情
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={toggleMut.isPending}
                              onClick={() =>
                                toggleMut.mutate({
                                  id: g.id,
                                  authentication: !g.authentication,
                                })
                              }
                            >
                              {g.authentication ? "关闭鉴权" : "开启鉴权"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>新建 / 更新</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs text-[var(--color-muted)]">网关 ID</label>
                <Input value={gwId} onChange={(e) => setGwId(e.target.value)} placeholder="qwen-gw" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={gwAuth}
                  onChange={(e) => setGwAuth(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                开启鉴权
              </label>
              <Button
                disabled={!gwId.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate({ id: gwId.trim(), authentication: gwAuth })}
              >
                创建 / 更新
              </Button>
            </div>
          </Card>
        </div>

        {selectedId && (
          <div className="lg:col-span-2">
            <GatewayDetailPanel ctx={ctxQ.data ?? null} loading={ctxQ.isLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
