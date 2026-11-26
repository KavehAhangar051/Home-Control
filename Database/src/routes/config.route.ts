/**
 * @file routes/config.route.ts
 * مدیریت مسیر /config — تنظیمات اصلی پروژه (Cloudflare KV + DO Alarms)
 *
 * بهینه‌سازی‌های اعمال‌شده:
 * - در POST: KV.put و DO.updateAutomations به‌صورت موازی اجرا می‌شوند
 * - JSON یک‌بار parse می‌شود و نتیجه در هر دو مسیر استفاده می‌شود
 */

import { jsonResponse } from "../utils/response";
import { buildEspConfigText } from "../utils/esp-config";

export { buildEspConfigText };

const CONFIG_KEY = "main_config";

/**
 * Handler اصلی برای /config
 */
export async function handleConfig(
	request: Request,
	env: Env,
	path: string[],
	method: string
): Promise<Response> {
	if (method === "GET") {
		const value = await env.DASH_KV.get(CONFIG_KEY);

		if (path[1] === "esp") {
			try {
				const text = await buildEspConfigText(env, value);
				return new Response(text, {
					headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
				});
			} catch {
				return new Response("ESP_CFG_V2\n", { headers: { "Content-Type": "text/plain" } });
			}
		}

		// برای داشبورد: کل JSON تنظیمات
		return new Response(value ?? "{}", { headers: { "Content-Type": "application/json" } });
	}

	if (method === "POST" && !path[1]) {
		let bodyText: string;
		let configData: Record<string, any>;

		try {
			bodyText = await request.text();
			configData = JSON.parse(bodyText);
		} catch {
			return jsonResponse({ ack: false, error: "خطا در پردازش درخواست." }, 400);
		}

		try {
			const automations = configData.automations ?? configData.payload?.automations ?? [];
			const macros = configData.macros ?? configData.payload?.macros ?? [];
			const stub = env.MY_DURABLE_OBJECT.get(
				env.MY_DURABLE_OBJECT.idFromName("automations_controller")
			);

			// KV write و DO update به‌صورت موازی
			await Promise.all([
				env.DASH_KV.put(CONFIG_KEY, bodyText),
				(stub as any).updateAutomations(automations, macros).catch((err: unknown) => {
					console.error("Failed to update DO alarms", err);
				}),
			]);

			return jsonResponse({ ack: true, message: "تنظیمات با موفقیت در سرور ذخیره شد." });
		} catch {
			return jsonResponse({ ack: false, error: "خطا در ذخیره تنظیمات در KV." }, 500);
		}
	}

	return new Response("Method Not Allowed", { status: 405 });
}
