import { describe, it, expect } from "vitest";
import {
  autoShowGatewayModelControls,
  detectWorkerCapabilities,
  inferWorkerEndpoints,
} from "../src/worker-capabilities";

describe("detectWorkerCapabilities", () => {
  it("detects AI gateway worker", () => {
    expect(
      detectWorkerCapabilities({ CF_GATEWAY_ID: "gw", DEFAULT_MODEL: "qwen-plus" }),
    ).toEqual({
      uses_gateway: true,
      uses_model: true,
      supports_chat: true,
    });
  });

  it("detects API-only worker without gateway or model vars", () => {
    expect(detectWorkerCapabilities({ RC_PROJECT_ID: "proj", SUPABASE_URL: "https://x" })).toEqual({
      uses_gateway: false,
      uses_model: false,
      supports_chat: false,
    });
  });

  it("gateway without model is not chat-capable", () => {
    expect(detectWorkerCapabilities({ CF_GATEWAY_ID: "gw" })).toEqual({
      uses_gateway: true,
      uses_model: false,
      supports_chat: false,
    });
  });
});

describe("autoShowGatewayModelControls", () => {
  it("hides when neither gateway nor model configured", () => {
    expect(autoShowGatewayModelControls(detectWorkerCapabilities({}))).toBe(false);
  });

  it("shows when model vars present", () => {
    expect(autoShowGatewayModelControls(detectWorkerCapabilities({ DEFAULT_MODEL: "m" }))).toBe(
      true,
    );
  });
});

describe("inferWorkerEndpoints", () => {
  it("includes chat routes only when supports_chat", () => {
    expect(inferWorkerEndpoints(detectWorkerCapabilities({ CF_GATEWAY_ID: "g", DEFAULT_MODEL: "m" })))
      .toEqual(["/health", "/v1/responses", "/v1/chat/completions"]);
    expect(inferWorkerEndpoints(detectWorkerCapabilities({ RC_PROJECT_ID: "p" }))).toEqual([
      "/health",
    ]);
  });
});
