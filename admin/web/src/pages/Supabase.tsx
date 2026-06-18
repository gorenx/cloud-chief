import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { SupabaseConnectPanel } from "@/components/SupabaseConnectPanel";
import { Card } from "@/components/ui/Card";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchPublicConfig } from "@/lib/api";
import { pickFields } from "@/lib/field-meta";

export function SupabasePage() {
  const { token } = useAdminToken();
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const configQ = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const r = await fetchPublicConfig();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  useEffect(() => {
    const supabase = searchParams.get("supabase");
    if (!supabase) return;
    if (supabase === "connected") {
      toast.success(t("playground.toastSupabaseStep1"));
      void configQ.refetch();
    } else if (supabase === "error") {
      const reason = searchParams.get("reason") ?? t("common.unknownError");
      toast.error(t("playground.toastSupabaseError", { reason }));
    }
    searchParams.delete("supabase");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, configQ, t]);

  if (!token) {
    return <NoTokenPrompt />;
  }

  const worker = configQ.data?.worker ?? null;
  const supabaseUrlMeta = pickFields(configQ.data?._meta)["worker.supabase_url"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("supabase.page.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("supabase.page.desc")}</p>
      </div>

      <Card className="p-4">
        <SupabaseConnectPanel
          supabaseUrl={worker?.supabase_url}
          supabaseUrlMeta={supabaseUrlMeta}
          hasAnonKey={worker?.has_anon_key ?? false}
          hasTestCredentials={worker?.has_test_credentials ?? false}
          testEmail={testEmail}
          onTestEmailChange={setTestEmail}
          testPassword={testPassword}
          onTestPasswordChange={setTestPassword}
          accessToken={accessToken}
          onAccessTokenChange={setAccessToken}
          onApplied={() => void configQ.refetch()}
        />
      </Card>
    </div>
  );
}
