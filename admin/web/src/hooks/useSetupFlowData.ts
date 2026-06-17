import { useQuery } from "@tanstack/react-query";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { fetchGatewayContext, fetchState } from "@/lib/api";
import { deriveSetupStatus } from "@/lib/setup-flow";

export function useSetupFlowData() {
  const { token } = useAdminToken();

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const defaultGw = stateQ.data?.defaults.gateway;
  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, defaultGw],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, defaultGw!);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && defaultGw),
  });

  const status = deriveSetupStatus(stateQ.data, ctxQ.data?.keys.length ?? 0);

  return { stateQ, ctxQ, status };
}
