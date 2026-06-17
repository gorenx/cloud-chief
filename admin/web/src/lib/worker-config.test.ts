import { describe, expect, it } from "vitest";
import { buildOnlineVarRows } from "../lib/worker-config";

describe("buildOnlineVarRows", () => {
  it("aligns with local keys and shows empty string when missing online", () => {
    const rows = buildOnlineVarRows(
      { CF_GATEWAY_ID: "qwen-gw", ALLOWED_SUBS: "" },
      [
        { k: "CF_GATEWAY_ID", v: "qwen-gw" },
        { k: "SUPABASE_URL", v: "https://x.supabase.co" },
        { k: "ALLOWED_SUBS", v: "" },
      ],
      true,
    );
    expect(rows).toEqual([
      { k: "CF_GATEWAY_ID", v: "qwen-gw" },
      { k: "SUPABASE_URL", v: "" },
      { k: "ALLOWED_SUBS", v: "" },
    ]);
  });

  it("appends online-only keys after local order", () => {
    const rows = buildOnlineVarRows(
      { A: "1", Z: "9" },
      [{ k: "A", v: "1" }],
      true,
    );
    expect(rows).toEqual([
      { k: "A", v: "1" },
      { k: "Z", v: "9" },
    ]);
  });
});
