import { SupabaseConnectPanel } from "@/components/SupabaseConnectPanel";
import type { SupabaseSetupStep } from "@/lib/supabase-setup-flow";
import type { FieldMetaEntry } from "@/types";

export type SupabasePanelProps = {
  variant: "page";
  supabaseUrl?: string | null;
  supabaseUrlMeta?: FieldMetaEntry;
  hasAnonKey: boolean;
  hasTestCredentials: boolean;
  testEmail: string;
  onTestEmailChange: (v: string) => void;
  testPassword: string;
  onTestPasswordChange: (v: string) => void;
  accessToken: string;
  onAccessTokenChange: (v: string) => void;
  onApplied?: () => void;
};

export function SupabaseStepContent({
  step,
  panelProps,
}: {
  step: SupabaseSetupStep;
  panelProps: SupabasePanelProps;
}) {
  return <SupabaseConnectPanel {...panelProps} activeStep={step} />;
}
