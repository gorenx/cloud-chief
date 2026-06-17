import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import {
  adminFetch,
  fetchWorkerList,
  fetchWorkerSecrets,
  fetchWorkerStatus,
} from "@/lib/api";
import { useSSEStream } from "@/hooks/useSSEStream";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { Link } from "react-router-dom";

function VarRow({
  k,
  v,
  onChange,
  onRemove,
}: {
  k: string;
  v: string;
  onChange: (k: string, v: string) => void;
  onRemove: () => void;
}) {
  const [key, setKey] = useState(k);
  const [val, setVal] = useState(v);
  return (
    <div className="flex gap-2">
      <Input
        className="max-w-[200px]"
        placeholder="变量名"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          onChange(e.target.value, val);
        }}
      />
      <Input
        placeholder="值"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(key, e.target.value);
        }}
      />
      <Button variant="ghost" size="sm" onClick={onRemove}>
        ✕
      </Button>
    </div>
  );
}

function SecretRow({
  name,
  value,
  fixed,
  localOk,
  prodOk,
  optional,
  onChange,
  onRemove,
}: {
  name: string;
  value: string;
  fixed?: boolean;
  localOk?: boolean;
  prodOk?: boolean | null;
  optional?: boolean;
  onChange: (name: string, value: string) => void;
  onRemove?: () => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="max-w-[200px]"
        value={name}
        readOnly={fixed}
        placeholder="Secret 名"
        onChange={(e) => onChange(e.target.value, val)}
      />
      <Input
        type="password"
        placeholder={fixed ? "留空则不改动" : "值"}
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(name, e.target.value);
        }}
      />
      <Chip variant={localOk ? "on" : "off"}>本地{localOk ? "✓" : "✗"}</Chip>
      {prodOk !== null && prodOk !== undefined && (
        <Chip variant={prodOk ? "on" : "off"}>生产{prodOk ? "✓" : "✗"}</Chip>
      )}
      {optional && <span className="text-[11px] text-[var(--color-muted)]">(可选)</span>}
      {!fixed && onRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          ✕
        </Button>
      )}
    </div>
  );
}

export function WorkerPage() {
  const { token } = useAdminToken();
  const qc = useQueryClient();
  const [workerDir, setWorkerDir] = useState("");
  const [vars, setVars] = useState<Array<{ k: string; v: string }>>([{ k: "", v: "" }]);
  const [secrets, setSecrets] = useState<
    Array<{ name: string; value: string; fixed: boolean; optional: boolean }>
  >([]);
  const [prodSet, setProdSet] = useState<Set<string> | null>(null);
  const deploy = useSSEStream();

  const workersQ = useQuery({
    queryKey: ["worker-list", token],
    queryFn: async () => {
      const r = await fetchWorkerList(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (workersQ.data && !workerDir) {
      setWorkerDir(workersQ.data.default);
    }
  }, [workersQ.data, workerDir]);

  const wq = workerDir ? `?dir=${encodeURIComponent(workerDir)}` : "";

  const statusQ = useQuery({
    queryKey: ["worker-status", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerStatus(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
  });

  useEffect(() => {
    const s = statusQ.data;
    if (!s) return;
    const entries = Object.entries(s.vars);
    setVars(entries.length ? entries.map(([k, v]) => ({ k, v })) : [{ k: "", v: "" }]);
    const seen = new Set<string>();
    const rows: typeof secrets = [];
    for (const sec of s.secrets) {
      seen.add(sec.name);
      rows.push({
        name: sec.name,
        value: s.dev_vars[sec.name] ?? "",
        fixed: true,
        optional: sec.optional,
      });
    }
    for (const [k, v] of Object.entries(s.dev_vars)) {
      if (!seen.has(k)) rows.push({ name: k, value: v, fixed: false, optional: false });
    }
    if (rows.length === 0) rows.push({ name: "", value: "", fixed: false, optional: false });
    setSecrets(rows);

    if (s.logged_in) {
      void fetchWorkerSecrets(token, workerDir || undefined).then((r) => {
        if (r.ok) setProdSet(new Set(r.data.names));
      });
    }
  }, [statusQ.data, token, workerDir]);

  const varsSave = useMutation({
    mutationFn: async () => {
      const obj: Record<string, string> = {};
      for (const { k, v } of vars) {
        if (!k.trim()) continue;
        if (!/^[A-Z][A-Z0-9_]*$/.test(k.trim())) throw new Error(`变量名 ${k} 非法`);
        obj[k.trim()] = v;
      }
      if (Object.keys(obj).length === 0) throw new Error("请至少填写一个变量");
      const r = await adminFetch(token, "PUT", `/admin/worker/config${wq}`, { vars: obj });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("已写入 wrangler.toml");
      void qc.invalidateQueries({ queryKey: ["worker-status"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const devVarsSave = useMutation({
    mutationFn: async () => {
      const obj = collectSecrets();
      if (!obj || Object.keys(obj).length === 0) throw new Error("没有填写任何 secret 值");
      const r = await adminFetch(token, "PUT", `/admin/worker/devvars${wq}`, { secrets: obj });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => toast.success("已写入本地 .dev.vars"),
    onError: (e) => toast.error(String(e)),
  });

  const secretsPush = useMutation({
    mutationFn: async () => {
      const obj = collectSecrets();
      if (!obj || Object.keys(obj).length === 0) throw new Error("没有填写任何 secret 值");
      for (const [name, value] of Object.entries(obj)) {
        const r = await adminFetch(token, "POST", `/admin/worker/secret${wq}`, { name, value });
        if (!r.ok) throw new Error(`推送 ${name} 失败: ${r.error}`);
      }
    },
    onSuccess: () => toast.success("已推送到生产"),
    onError: (e) => toast.error(String(e)),
  });

  function collectSecrets(): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const s of secrets) {
      if (!s.name.trim() || !s.value) continue;
      if (!/^[A-Z][A-Z0-9_]*$/.test(s.name.trim())) {
        toast.error(`Secret 名 ${s.name} 非法`);
        return null;
      }
      out[s.name.trim()] = s.value;
    }
    return out;
  }

  const localSet = new Set(statusQ.data?.local_secrets ?? []);

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        请先在 <Link to="/settings" className="text-[var(--color-accent)]">设置</Link> 配置令牌。
      </p>
    );
  }

  const s = statusQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Worker 部署</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          通过本机 wrangler 部署边缘代理；密钥经 stdin 传入
        </p>
      </div>

      <Card>
        <label className="mb-1 block text-xs text-[var(--color-muted)]">Worker 目录</label>
        <Select
          value={workerDir}
          onChange={(e) => setWorkerDir(e.target.value)}
          className="max-w-md"
        >
          {(workersQ.data?.workers ?? []).map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </Select>
        {s && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
            <span>
              wrangler:{" "}
              {s.wrangler_version ? (
                <code className="mono">{s.wrangler_version}</code>
              ) : (
                <span className="text-red-400">未检测到</span>
              )}
            </span>
            <Chip variant={s.logged_in ? "on" : "off"}>
              {s.logged_in ? "已登录" : "未登录"}
            </Chip>
            <span>
              Worker: <code className="mono">{s.worker_name ?? "-"}</code>
            </span>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle desc="wrangler.toml [vars]">环境变量</CardTitle>
        <div className="space-y-2">
          {vars.map((row, i) => (
            <VarRow
              key={i}
              k={row.k}
              v={row.v}
              onChange={(k, v) => {
                const next = [...vars];
                next[i] = { k, v };
                setVars(next);
              }}
              onRemove={() => setVars(vars.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setVars([...vars, { k: "", v: "" }])}>
            + 添加变量
          </Button>
          <Button variant="ghost" size="sm" onClick={() => varsSave.mutate()}>
            保存变量
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle desc="清单来自 .dev.vars.example">私密配置 Secrets</CardTitle>
        <div className="space-y-3">
          {secrets.map((row, i) => (
            <SecretRow
              key={`${row.name}-${i}`}
              name={row.name}
              value={row.value}
              fixed={row.fixed}
              optional={row.optional}
              localOk={row.name ? localSet.has(row.name) : false}
              prodOk={row.name && prodSet ? prodSet.has(row.name) : null}
              onChange={(name, value) => {
                const next = [...secrets];
                next[i] = { ...next[i], name, value };
                setSecrets(next);
              }}
              onRemove={
                row.fixed
                  ? undefined
                  : () => setSecrets(secrets.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSecrets([...secrets, { name: "", value: "", fixed: false, optional: false }])
            }
          >
            + 添加 secret
          </Button>
          <Button variant="ghost" size="sm" onClick={() => devVarsSave.mutate()}>
            保存到本地 .dev.vars
          </Button>
          <Button variant="ghost" size="sm" onClick={() => secretsPush.mutate()}>
            推送到生产
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex gap-2">
          <Button
            disabled={deploy.running}
            onClick={() => {
              deploy.setLines([]);
              void deploy.start(`/admin/worker/deploy${wq}`, {
                headers: { Authorization: `Bearer ${token}` },
                onEvent: (e) => {
                  if (e.event === "done") {
                    toast.success(e.data === "0" ? "部署成功" : `退出码 ${e.data}`);
                    void qc.invalidateQueries({ queryKey: ["worker-status"] });
                  }
                  if (e.event === "error") toast.error(e.data);
                },
              });
            }}
          >
            部署 Worker
          </Button>
          <Button variant="ghost" onClick={() => void qc.invalidateQueries({ queryKey: ["worker-status"] })}>
            刷新状态
          </Button>
        </div>
        {deploy.lines.length > 0 && (
          <pre className="mono mt-4 max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[#0a0d11] p-4 text-xs leading-relaxed text-[#cdd6e4]">
            {deploy.lines.join("\n")}
          </pre>
        )}
      </Card>
    </div>
  );
}
