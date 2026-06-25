import { env } from "./env";

function cfBase(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}`;
}

export interface CfResult {
  status: number;
  json: {
    success?: boolean;
    result?: unknown;
    errors?: Array<{ message?: string } | unknown>;
    raw?: string;
    [k: string]: unknown;
  };
}

export async function cfApi(
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<CfResult> {
  try {
    const r = await fetch(cfBase() + apiPath, {
      method,
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: CfResult["json"];
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, raw: text };
    }
    return { status: r.status, json };
  } catch (e) {
    return {
      status: 0,
      json: { success: false, errors: [{ message: (e as Error).message }] },
    };
  }
}

/** Worker settings PATCH：CF API token 不支持 PUT，需 multipart + settings JSON */
export async function cfApiWorkerSettingsPatch(
  scriptName: string,
  settings: Record<string, unknown>,
): Promise<CfResult> {
  const form = new FormData();
  form.set("settings", JSON.stringify(settings));
  try {
    const r = await fetch(
      `${cfBase()}/workers/scripts/${encodeURIComponent(scriptName)}/settings`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
        },
        body: form,
      },
    );
    const text = await r.text();
    let json: CfResult["json"];
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, raw: text };
    }
    return { status: r.status, json };
  } catch (e) {
    return {
      status: 0,
      json: { success: false, errors: [{ message: (e as Error).message }] },
    };
  }
}

import { gatewayUrlWithAccount as gwUrl } from "./gateway-url";

export const gatewayUrl = (gw: string, slug: string, p: string): string =>
  gatewayUrlWithAccount(env.CF_ACCOUNT_ID, gw, slug, p);

export function gatewayUrlWithAccount(
  accountId: string,
  gw: string,
  slug: string,
  p: string,
): string {
  return gwUrl(accountId, gw, slug, p);
}
