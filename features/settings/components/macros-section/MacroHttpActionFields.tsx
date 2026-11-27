"use client";

import { useId } from "react";
import { Plus, Trash2 } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  MacroHttpHeader,
  MacroHttpMethod,
  MacroHttpRequestConfig,
} from "@/features/iot/hooks/store/types";
import {
  MAX_MACRO_HTTP_TIMEOUT_MS,
  MIN_MACRO_HTTP_TIMEOUT_MS,
} from "@/features/iot/utils/macroActionHelpers";
import {
  DEFAULT_MACRO_HTTP_TIMEOUT_MS,
  VALID_MACRO_HTTP_METHODS,
} from "@/features/iot/utils/macroEngine";

interface MacroHttpActionFieldsProps {
  index: number;
  request?: MacroHttpRequestConfig;
  onChange: (request: MacroHttpRequestConfig) => void;
}

const CONTENT_TYPE_PRESETS = [
  "application/json",
  "text/plain",
  "application/x-www-form-urlencoded",
] as const;

export function MacroHttpActionFields({ index, request, onChange }: MacroHttpActionFieldsProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const methodId = `${baseId}-method`;
  const urlId = `${baseId}-url`;
  const timeoutId = `${baseId}-timeout`;
  const contentTypeId = `${baseId}-ctype`;
  const bodyId = `${baseId}-body`;

  const current: MacroHttpRequestConfig = {
    method: request?.method ?? "POST",
    url: request?.url ?? "",
    label: request?.label ?? "",
    contentType: request?.contentType ?? "application/json",
    headers: request?.headers ?? [],
    body: request?.body ?? "",
    timeoutMs: request?.timeoutMs ?? DEFAULT_MACRO_HTTP_TIMEOUT_MS,
  };

  const patchRequest = (patch: Partial<MacroHttpRequestConfig>) => {
    onChange({
      ...current,
      ...patch,
    });
  };

  const handleAddHeader = () => {
    const nextHeaders: MacroHttpHeader[] = [
      ...(current.headers ?? []),
      { id: `hdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: "", value: "" },
    ];
    patchRequest({ headers: nextHeaders });
  };

  const handleUpdateHeader = (hIdx: number, field: "key" | "value", value: string) => {
    const nextHeaders = (current.headers ?? []).map((h, i) =>
      i === hIdx ? { ...h, [field]: value } : h,
    );
    patchRequest({ headers: nextHeaders });
  };

  const handleRemoveHeader = (hIdx: number) => {
    const nextHeaders = (current.headers ?? []).filter((_, i) => i !== hIdx);
    patchRequest({ headers: nextHeaders });
  };

  const supportsBody = current.method !== "GET";

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/60 p-3 text-xs">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={labelId} className="font-semibold text-text-secondary">
            عنوان درخواست (اختیاری)
          </Label>
          <Input
            id={labelId}
            type="text"
            value={current.label ?? ""}
            onChange={(e) => patchRequest({ label: e.target.value })}
            placeholder="مثال: WLED یا وب‌هوک"
            className="bg-card-bg-solid text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={methodId} className="font-semibold text-text-secondary">
              متد HTTP
            </Label>
            <Select
              id={methodId}
              aria-label={`متد درخواست عملیات ${index + 1}`}
              value={current.method}
              onChange={(e) => patchRequest({ method: e.target.value as MacroHttpMethod })}
              className="bg-card-bg-solid font-mono text-xs"
              dir="ltr"
            >
              {VALID_MACRO_HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor={timeoutId} className="font-semibold text-text-secondary">
              مهلت (ms)
            </Label>
            <Input
              id={timeoutId}
              type="number"
              dir="ltr"
              min={MIN_MACRO_HTTP_TIMEOUT_MS}
              max={MAX_MACRO_HTTP_TIMEOUT_MS}
              step={100}
              value={current.timeoutMs ?? DEFAULT_MACRO_HTTP_TIMEOUT_MS}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                patchRequest({
                  timeoutMs: Number.isFinite(parsed)
                    ? Math.min(
                        MAX_MACRO_HTTP_TIMEOUT_MS,
                        Math.max(MIN_MACRO_HTTP_TIMEOUT_MS, parsed),
                      )
                    : DEFAULT_MACRO_HTTP_TIMEOUT_MS,
                });
              }}
              className="bg-card-bg-solid font-mono text-xs tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={urlId} className="font-semibold text-text-secondary">
          نشانی مقصد (URL)
        </Label>
        <Input
          id={urlId}
          type="url"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          aria-label={`نشانی درخواست عملیات ${index + 1}`}
          value={current.url}
          onChange={(e) => patchRequest({ url: e.target.value })}
          placeholder="http://192.168.1.50/json/state"
          className="bg-card-bg-solid font-mono text-xs"
        />
      </div>

      {/* Custom Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-text-secondary">سربرگ‌های سفارشی (Headers)</span>
          <button
            type="button"
            onClick={handleAddHeader}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-card-bg-solid px-2.5 text-[11px] font-semibold text-text-primary transition-colors hover:border-accent3/60 hover:text-accent3"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            افزودن سربرگ
          </button>
        </div>

        {(current.headers ?? []).length > 0 && (
          <div className="space-y-1.5">
            {(current.headers ?? []).map((hdr, hIdx) => (
              <div
                key={hdr.id ?? `${baseId}-hdr-${hIdx}`}
                className="flex items-center gap-1.5"
                dir="ltr"
              >
                <Input
                  type="text"
                  value={hdr.key}
                  onChange={(e) => handleUpdateHeader(hIdx, "key", e.target.value)}
                  placeholder="Authorization"
                  aria-label="Header name"
                  className="bg-card-bg-solid font-mono text-xs"
                />
                <Input
                  type="text"
                  value={hdr.value}
                  onChange={(e) => handleUpdateHeader(hIdx, "value", e.target.value)}
                  placeholder="Bearer ..."
                  aria-label="Header value"
                  className="bg-card-bg-solid font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveHeader(hIdx)}
                  aria-label="حذف سربرگ"
                  className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-color bg-card-bg-solid text-text-muted transition-colors hover:border-destructive/50 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {supportsBody && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={contentTypeId} className="font-semibold text-text-secondary">
              نوع محتوا (Content-Type)
            </Label>
            <Select
              id={contentTypeId}
              value={current.contentType ?? "application/json"}
              onChange={(e) => patchRequest({ contentType: e.target.value })}
              className="bg-card-bg-solid font-mono text-xs"
              dir="ltr"
            >
              {CONTENT_TYPE_PRESETS.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor={bodyId} className="font-semibold text-text-secondary">
              بدنه درخواست (Body)
            </Label>
            <Textarea
              id={bodyId}
              dir="ltr"
              rows={3}
              value={current.body ?? ""}
              onChange={(e) => patchRequest({ body: e.target.value })}
              placeholder='{"on": true}'
              className="bg-card-bg-solid font-mono text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
