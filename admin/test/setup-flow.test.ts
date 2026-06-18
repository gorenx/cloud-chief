import { describe, expect, it } from "vitest";
import {
  deriveSetupStatus,
  nextSetupAction,
  resolveSetupCurrent,
  setupSetupWarningKeys,
  stepDone,
} from "../src/setup-flow";

describe("setup-flow", () => {
  const empty = deriveSetupStatus(undefined);

  it("derives empty status when state is missing", () => {
    expect(empty.gatewayDone).toBe(false);
    expect(empty.providerDone).toBe(false);
    expect(empty.byokDone).toBe(false);
  });

  it("marks gateway done when gateways exist", () => {
    const s = deriveSetupStatus({
      defaults: { gateway: "gw1", provider_slug: "" },
      gateways: [{ id: "gw1" }],
      providers: [],
    });
    expect(s.gatewayDone).toBe(true);
    expect(s.providerDone).toBe(false);
  });

  it("returns createGateway action when gateway missing", () => {
    const status = deriveSetupStatus({
      defaults: { gateway: "", provider_slug: "" },
      gateways: [],
      providers: [],
    });
    expect(nextSetupAction(status, "provider")).toEqual({
      key: "createGateway",
      to: "/gateways",
    });
    expect(nextSetupAction(status, "gateway")).toBeNull();
  });

  it("returns addProvider action when provider missing", () => {
    const status = deriveSetupStatus({
      defaults: { gateway: "gw1", provider_slug: "" },
      gateways: [{ id: "gw1" }],
      providers: [],
    });
    expect(nextSetupAction(status, "gateway")).toEqual({
      key: "addProvider",
      to: "/providers",
    });
    expect(nextSetupAction(status, "provider")).toBeNull();
  });

  it("returns goPlayground when core steps done", () => {
    const status = deriveSetupStatus(
      {
        defaults: { gateway: "gw1", provider_slug: "slug1" },
        gateways: [{ id: "gw1" }],
        providers: [{ slug: "slug1" }],
      },
      0,
    );
    expect(nextSetupAction(status, "gateway")).toEqual({
      key: "goPlayground",
      to: "/playground",
    });
    expect(nextSetupAction(status, "byok")).toBeNull();
  });

  it("resolves current step from status", () => {
    expect(resolveSetupCurrent(undefined, empty)).toBe("gateway");
    const withGw = deriveSetupStatus({
      defaults: { gateway: "gw1", provider_slug: "" },
      gateways: [{ id: "gw1" }],
      providers: [],
    });
    expect(resolveSetupCurrent(undefined, withGw)).toBe("provider");
  });

  it("tracks step completion", () => {
    const status = deriveSetupStatus(
      {
        defaults: { gateway: "gw1", provider_slug: "s1" },
        gateways: [{ id: "gw1" }],
        providers: [{ slug: "s1" }],
      },
      2,
    );
    expect(stepDone("gateway", status)).toBe(true);
    expect(stepDone("provider", status)).toBe(true);
    expect(stepDone("byok", status)).toBe(true);
  });

  it("returns page hints via setupSetupWarningKeys", () => {
    const status = deriveSetupStatus({
      defaults: { gateway: "", provider_slug: "" },
      gateways: [],
      providers: [],
    });
    expect(setupSetupWarningKeys(status, "gateway")).toEqual(["hintGateway"]);
    expect(setupSetupWarningKeys(status, "provider")).toEqual([]);

    const withGw = deriveSetupStatus({
      defaults: { gateway: "gw1", provider_slug: "" },
      gateways: [{ id: "gw1" }],
      providers: [],
    });
    expect(setupSetupWarningKeys(withGw, "provider")).toEqual(["hintProvider"]);
  });
});
