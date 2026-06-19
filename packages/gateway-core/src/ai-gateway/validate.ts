import { AiGatewayError } from "./errors.js";

const PERIOD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertPeriod(period: string) {
  if (!PERIOD_RE.test(period)) {
    throw new AiGatewayError("invalid period_key");
  }
}

export function assertQuota(quota: number) {
  if (quota < 1 || quota > 100) {
    throw new AiGatewayError("invalid quota");
  }
}

export function assertDeviceId(device: string | null | undefined) {
  if (device != null && device.length > 80) {
    throw new AiGatewayError("invalid device_id");
  }
}

export function validateSpendInputs(
  period: string,
  quota: number,
  device: string | null,
  deviceCap: number,
  ipCap: number,
) {
  assertPeriod(period);
  assertQuota(quota);
  assertDeviceId(device);
  if (deviceCap < 1 || deviceCap > 1000 || ipCap < 1 || ipCap > 1000) {
    throw new AiGatewayError("invalid throttle cap");
  }
}
