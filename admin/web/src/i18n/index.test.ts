import { describe, expect, it } from "vitest";
import { translate } from "./index";
import type { MessageKey } from "./messages/types";

describe("i18n", () => {
  it("translates worker button keys in zh and en", () => {
    expect(translate("zh", "btn.worker.deploy")).toBe("部署 Worker");
    expect(translate("en", "btn.worker.deploy")).toBe("Deploy Worker");
  });

  it("falls back to key for missing path", () => {
    expect(translate("en", "btn.missing.key" as MessageKey)).toBe("btn.missing.key");
  });

  it("translates API i18n error keys", () => {
    expect(translate("zh", "common.unknownError")).toBe("未知错误");
    expect(translate("en", "common.configReadError")).toBe("Could not read config");
  });
});
