import type { TranslateFn } from "./index";
import type { PlaygroundSessionFlags } from "../lib/playground-session";

export function emptyChatHint(t: TranslateFn, flags: PlaygroundSessionFlags): string {
  if (!flags.isWorker) return t("playground.chatHintGateway");
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
