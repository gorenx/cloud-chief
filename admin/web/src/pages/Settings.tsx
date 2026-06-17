import { useState } from "react";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function SettingsPage() {
  const { token, setToken, saveToken } = useAdminToken();
  const [draft, setDraft] = useState(token);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">连接设置</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          admin 令牌用于访问 /admin/* 管理接口，保存在浏览器 localStorage
        </p>
      </div>

      <Card>
        <CardTitle>Admin 令牌</CardTitle>
        <Input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="与 .env 中 ADMIN_TOKEN 一致"
        />
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              saveToken(draft.trim());
              toast.success("令牌已保存");
            }}
          >
            保存
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft("");
              setToken("");
              localStorage.removeItem("admin_token");
              toast.success("已清除");
            }}
          >
            清除
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle desc="内网部署时请配置">服务端提示</CardTitle>
        <ul className="space-y-2 text-sm text-[var(--color-muted)]">
          <li>默认监听 <code className="mono">127.0.0.1:8787</code></li>
          <li>内网访问：设置 <code className="mono">ADMIN_BIND=0.0.0.0</code> 并使用强令牌</li>
          <li>建议前置 Nginx/Caddy 做 TLS 与 IP 白名单</li>
          <li>Worker 部署需本机 wrangler 已登录或配置 CLOUDFLARE_API_TOKEN</li>
        </ul>
      </Card>
    </div>
  );
}
