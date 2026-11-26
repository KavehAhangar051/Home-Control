/**
 * @file durable-object/MyDurableObject.ts
 * Durable Object اصلی: مدیریت WebSocket، state پین‌ها، و اتوماسیون‌ها
 *
 * پشتیبانی از:
 * - کانفیگ ESP_CFG_V2 کامل (سگمنت‌های دیجیتال، آنالوگ PWM/ADC، بردهای کمکی و مجازی، قوانین v2)
 * - همگام‌سازی مقادیر آنالوگ (values / resolutions / lastNonZeroValue) در sync_pin، state_sync و get_all_states
 */

import { DurableObject } from "cloudflare:workers";
import { scheduleNextAlarm, fireAlarm, type PendingAutomationPin } from "./alarm-manager";
import { formatTehranTime } from "../utils/scheduler";
import { buildEspConfigText, isAnalogInputType, isAnalogOutputType, parseManagedPin } from "../utils/esp-config";
import type { Automation, Macro, PinConfig, PinState } from "../types";

const MAX_ANALOG_VALUE = 4095;

export class MyDurableObject extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	private getPinStub(pin: string | number) {
		return this.env.MY_DURABLE_OBJECT.get(
			this.env.MY_DURABLE_OBJECT.idFromName("pin_" + pin)
		);
	}

	private updatePinDoState(pin: string | number, data: Record<string, unknown>): void {
		const pinDo = this.getPinStub(pin);
		this.ctx.waitUntil((pinDo as any).setState(data));
	}

	async fetch(request: Request): Promise<Response> {
		// WebSocket upgrade
		if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
			const [client, server] = Object.values(new WebSocketPair());
			this.ctx.acceptWebSocket(server);
			return new Response(null, { status: 101, webSocket: client });
		}

		// Internal route: به‌روزرسانی وضعیت پین از طریق fetch داخلی
		const url = new URL(request.url);
		if (url.pathname.startsWith("/pins/") && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			await this.setState(body);
			return new Response("OK");
		}

		return new Response("Not found", { status: 404 });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== "string") return;
		try {
			const data = JSON.parse(message) as {
				type: string;
				pin?: string | number;
				state?: unknown;
				value?: unknown;
				resolution?: unknown;
				status?: string;
				states?: Record<string, unknown>;
				values?: Record<string, unknown>;
				resolutions?: Record<string, unknown>;
			};

			if (data.type === "get_config") {
				console.log("[WebSocket] Config requested by ESP32");
				const value = await this.env.DASH_KV.get("main_config");
				const configText = await buildEspConfigText(this.env, value);
				ws.send(configText);
				return;
			}

			if (data.type === "get_all_states") {
				console.log("[WebSocket] get_all_states requested by ESP32");
				const configValue = await this.env.DASH_KV.get("main_config");
				if (!configValue) return;

				const parsed = JSON.parse(configValue);
				const configData = parsed?.payload ?? parsed ?? {};
				const segments: PinConfig[] = configData.segments_definition ?? configData.segments ?? [];
				const states: Record<string, boolean> = {};
				const values: Record<string, number> = {};

				await Promise.all(
					segments.map(async (seg) => {
						try {
							if (!seg || seg.type === "placeholder" || isAnalogInputType(seg.type)) return;
							const pinNum = parseManagedPin(seg.pin);
							if (pinNum === null) return;

							const pinKey = String(pinNum);
							const state = (await (this.getPinStub(pinKey) as any).getState()) as PinState;
							states[pinKey] = state?.value === true;

							if (isAnalogOutputType(seg.type) && typeof state?.analogValue === "number" && Number.isFinite(state.analogValue)) {
								values[pinKey] = state.analogValue;
							}
						} catch {
							// نادیده گرفتن خطای خواندن تک‌پین
						}
					})
				);

				const syncPayload =
					Object.keys(values).length > 0
						? { type: "state_sync", states, values }
						: { type: "state_sync", states };
				ws.send(JSON.stringify(syncPayload));
				return;
			}

			if (data.type === "state_sync") {
				console.log("[WebSocket] state_sync received from ESP32");
				const states = data.states && typeof data.states === "object" ? data.states : {};
				const values = data.values && typeof data.values === "object" ? data.values : {};
				const resolutions = data.resolutions && typeof data.resolutions === "object" ? data.resolutions : {};

				const pinKeys = new Set<string>([
					...Object.keys(states),
					...Object.keys(values),
				]);

				for (const pinStr of pinKeys) {
					const update: Record<string, unknown> = {};
					if (Object.prototype.hasOwnProperty.call(states, pinStr)) {
						update.value = states[pinStr] === true;
					}
					const rawVal = values[pinStr];
					if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
						const clamped = Math.max(0, Math.min(MAX_ANALOG_VALUE, Math.round(rawVal)));
						update.analogValue = clamped;
						if (clamped > 0) update.lastNonZeroValue = clamped;
						if (update.value === undefined) update.value = clamped > 0;
					}
					const rawRes = resolutions[pinStr];
					if (typeof rawRes === "number" && Number.isFinite(rawRes)) {
						update.resolution = Math.round(rawRes);
					}
					if (Object.keys(update).length > 0) {
						this.updatePinDoState(pinStr, update);
					}
				}
				return;
			}

			if (data.type === "automation_ack") {
				console.log(`[Automation] Feedback received from ESP32: ${data.status}`);
				const pending = await this.ctx.storage.get<PendingAutomationPin[]>("pending_automation_states");
				if (pending) {
					for (const p of pending) {
						const update: Record<string, unknown> = { value: p.state };
						if (typeof p.analogValue === "number" && Number.isFinite(p.analogValue)) {
							update.analogValue = p.analogValue;
							if (p.analogValue > 0) update.lastNonZeroValue = p.analogValue;
						}
						this.updatePinDoState(p.pin, update);
					}
					await this.ctx.storage.delete("pending_automation_states");
				}
				return;
			}

			if (data.type !== "sync_pin" || data.pin === undefined) return;

			const update: Record<string, unknown> = { value: data.state === true };
			if (typeof data.value === "number" && Number.isFinite(data.value)) {
				const clamped = Math.max(0, Math.min(MAX_ANALOG_VALUE, Math.round(data.value)));
				update.analogValue = clamped;
				if (clamped > 0) update.lastNonZeroValue = clamped;
			}
			if (typeof data.resolution === "number" && Number.isFinite(data.resolution)) {
				update.resolution = Math.round(data.resolution);
			}
			this.updatePinDoState(data.pin, update);
		} catch (e) {
			console.error("WS parse error", e);
		}
	}

	webSocketClose(ws: WebSocket): void {
		ws.close();
	}

	webSocketError(ws: WebSocket): void {
		ws.close();
	}

	/** ارسال payload باینری به تمام WebSocket‌های متصل */
	async testBroadcast(payload: Uint8Array): Promise<void> {
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(payload);
			} catch {
				// اتصال قطع شده — نادیده گرفته می‌شود
			}
		}
	}

	/** گرفتن وضعیت کلی از storage */
	async getState(): Promise<Record<string, unknown>> {
		return ((await this.ctx.storage.get("data")) as Record<string, unknown>) ?? {};
	}

	/** به‌روزرسانی جزئی یا کلی وضعیت در storage */
	async setState(newData: Record<string, unknown>): Promise<Record<string, unknown>> {
		const current = await this.getState();
		const updated = { ...current, ...newData };
		await this.ctx.storage.put("data", updated);
		return updated;
	}

	/** ذخیره اتوماسیون‌ها، زمانبندی آلارم بعدی در Worker و ارسال تاییدیه به ESP32 */
	async updateAutomations(automations: Automation[], macros: Macro[] = []): Promise<void> {
		await Promise.all([
			this.ctx.storage.put("automations", automations),
			this.ctx.storage.put("macros", macros),
		]);

		const summary = await scheduleNextAlarm(this.ctx.storage);
		const confirmMsg =
			summary.nextTime !== null
				? `[Worker][Automation] Saved ${automations.length} automation(s) (${summary.activeCount} active). Next alarm: ${formatTehranTime(summary.nextTime)} IRST (in ${Math.max(0, Math.round((summary.nextTime - Date.now()) / 1000))}s) -> [${summary.nextAlarmTitles.join(", ")}]`
				: `[Worker][Automation] Saved ${automations.length} automation(s) (${summary.activeCount} active). No upcoming alarm scheduled.`;

		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(confirmMsg);
			} catch {
				// اتصال قطع شده — نادیده گرفته می‌شود
			}
		}
	}

	/** فراخوانی توسط Cloudflare هنگام رسیدن زمان آلارم */
	async alarm(): Promise<void> {
		await fireAlarm(this.ctx.storage, () => this.ctx.getWebSockets(), this.env);
	}
}
