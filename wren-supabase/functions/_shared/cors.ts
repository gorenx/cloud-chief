// Shared CORS headers. The app calls the gateway from native platforms, but a
// permissive header keeps web/dev builds working too. Auth is by JWT, not
// origin, so a wildcard origin is safe here.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
