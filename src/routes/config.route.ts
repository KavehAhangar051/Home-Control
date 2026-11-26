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
import type { DashboardPreferences } from "../types";

export { buildEspConfigText };

const CONFIG_KEY = "main_config";
const HEX_COLOR_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function clampThemePercent(raw: unknown, fallback = 70): number {
	const num = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
	if (typeof num !== "number" || !Number.isFinite(num)) return fallback;
	return Math.min(100, Math.max(0, Math.round(num)));
}

function normalizeHexAccent(raw: unknown, fallback: string): string {
	if (typeof raw !== "string") return fallback;
	const trimmed = raw.trim();
	return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

function normalizePreferencesObject(raw: Record<string, any> | undefined): DashboardPreferences {
	const prefs = raw && typeof raw === "object" ? raw : {};
	return {
		...prefs,
		theme_mode: prefs.theme_mode === "light" ? "light" : "dark",
		accent_color_3: normalizeHexAccent(prefs.accent_color_3, "#E5E7EB"),
		accent_color_4: normalizeHexAccent(prefs.accent_color_4, "#3B82F6"),
		dark_blackness: clampThemePercent(prefs.dark_blackness ?? prefs.darkBlackness, 70),
		light_whiteness: clampThemePercent(prefs.light_whiteness ?? prefs.lightWhiteness, 70),
	};
}

function normalizeStoredConfigPreferences(configData: Record<string, any>): boolean {
	if (!configData || typeof configData !== "object") return false;
	let changed = false;

	if (configData.preferences && typeof configData.preferences === "object") {
		configData.preferences = normalizePreferencesObject(configData.preferences);
		changed = true;
	}

	if (
		configData.payload &&
		typeof configData.payload === "object" &&
		configData.payload.preferences &&
		typeof configData.payload.preferences === "object"
	) {
		configData.payload.preferences = normalizePreferencesObject(configData.payload.preferences);
		changed = true;
	}

	return changed;
}

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

		// برای داشبورد: کل JSON تنظیمات همراه با تضمین فیلدهای preferences
		if (!value) {
			return new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, private",
        },
      });
		}
		try {
			const parsed = JSON.parse(value) as Record<string, any>;
			if (normalizeStoredConfigPreferences(parsed)) {
				return new Response(JSON.stringify(parsed), {
					headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store, private",
                  },
				});
			}
		} catch {
			// اگر مقدار ذخیره شده JSON معتبر نباشد همان متن برگردانده می‌شود
		}
		return new Response(value, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, private",
          },
        });
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
			if (normalizeStoredConfigPreferences(configData)) {
				bodyText = JSON.stringify(configData);
			}
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
