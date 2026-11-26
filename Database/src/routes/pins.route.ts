/**
 * @file routes/pins.route.ts
 * مدیریت مسیر /pins/:id — وضعیت پین‌های فیزیکی و مجازی (Durable Object)
 * پشتیبانی از پین‌های دیجیتال، خروجی آنالوگ PWM (analogValue / lastNonZeroValue) و بازه 0..127
 */

import { jsonResponse } from "../utils/response";

const MAX_ANALOG_VALUE = 4095;

function buildPinStateUpdate(body: {
	value?: unknown;
	state?: unknown;
	analogValue?: unknown;
}): Record<string, unknown> | null {
	const hasAnalog = typeof body.analogValue === "number" && Number.isFinite(body.analogValue);
	const boolInput = typeof body.value === "boolean" ? body.value : typeof body.state === "boolean" ? body.state : undefined;

	if (!hasAnalog && boolInput === undefined) {
		return null;
	}

	if (hasAnalog) {
		const analogValue = Math.max(0, Math.min(MAX_ANALOG_VALUE, Math.round(body.analogValue as number)));
		const value = boolInput ?? analogValue > 0;
		return analogValue > 0
			? { value, analogValue, lastNonZeroValue: analogValue }
			: { value, analogValue };
	}

	return { value: boolInput as boolean };
}

/**
 * Handler برای GET/POST /pins/:id
 */
export async function handlePins(
	request: Request,
	env: Env,
	path: string[],
	method: string
): Promise<Response> {
	const pinId = path[1];

	if (!pinId) {
		return jsonResponse({ ack: false, error: "Pin ID required" }, 400);
	}

	if (pinId === "batch" && method === "POST") {
		try {
			const body = (await request.json()) as {
				actions: Array<{ pin: string | number; state: boolean; analogValue?: number }>;
			};

			if (!Array.isArray(body.actions)) {
				return jsonResponse({ ack: false, error: "Invalid body, 'actions' must be an array" }, 400);
			}

			await Promise.all(
				body.actions.map(async (action) => {
					const stub = env.MY_DURABLE_OBJECT.get(
						env.MY_DURABLE_OBJECT.idFromName("pin_" + action.pin)
					);
					const update = buildPinStateUpdate({
						state: action.state,
						analogValue: action.analogValue,
					}) ?? { value: !!action.state };
					return (stub as any).setState(update);
				})
			);

			return jsonResponse({
				ack: true,
				message: `وضعیت ${body.actions.length} پین با موفقیت به‌روزرسانی شد.`,
			});
		} catch {
			return jsonResponse({ ack: false, error: "خطا در بروزرسانی گروهی پین‌ها." }, 500);
		}
	}

	const stub = env.MY_DURABLE_OBJECT.get(env.MY_DURABLE_OBJECT.idFromName("pin_" + pinId));

	if (method === "GET") {
		const result = await (stub as any).getState();
		return jsonResponse(result);
	}

	if (method === "POST") {
		try {
			const body = (await request.json()) as {
				value?: unknown;
				state?: unknown;
				analogValue?: unknown;
			};

			const update = buildPinStateUpdate(body);
			if (!update) {
				return jsonResponse(
					{ ack: false, error: "Invalid body, 'value' (boolean) or 'analogValue' (number) is required" },
					400
				);
			}

			const result = await (stub as any).setState(update);
			return jsonResponse({
				ack: true,
				message: `وضعیت پین ${pinId} با موفقیت ذخیره شد.`,
				data: result,
			});
		} catch {
			return jsonResponse({ ack: false, error: `خطا در ذخیره وضعیت پین ${pinId}.` }, 500);
		}
	}

	return new Response("Method Not Allowed", { status: 405 });
}
