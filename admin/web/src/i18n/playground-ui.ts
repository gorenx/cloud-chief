import type { TranslateFn } from "./index";
import type { ChatPath } from "../lib/playground-session";
import type { PlaygroundSessionFlags } from "../lib/playground-session";

export function emptyChatHint(
  t: TranslateFn,
  path: ChatPath,
  flags: PlaygroundSessionFlags,
): string {
  if (path === "gateway") return t("playground.chatHintGateway");
  if (flags.useWorkerToml) return t("playground.chatHintWorkerToml");
  return t("playground.chatHintWorkerUi");
}

export function getPlaygroundSourceLabels(t: TranslateFn) {
  return {
    gateway: t("playground.sourceGateway"),
    model: t("playground.sourceModel"),
    auth: t("playground.sourceAuth"),
    routingCompare: t("playground.sourceRoutingCompare"),
    routing: t("playground.sourceRouting"),
  };
}
