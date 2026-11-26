"use client";

import { useId, useRef } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  MacroHttpHeader,
  MacroHttpMethod,
  MacroHttpRequestConfig,
} from "@/features/iot/hooks/store/types";
import {
  DEFAULT_MACRO_HTTP_TIMEOUT_MS,
  VALID_MACRO_HTTP_METHODS,
} from "@/features/iot/utils/macroEngine";

const CONTENT_TYPE_OPTIONS = [
  { value: "application/json", label: "application/json" },
  { value: "text/plain", label: "text/plain" },
  { value: "application/x-www-form-urlencoded", label: "application/x-www-form-urlencoded" },
  { value: "", label: "بدون Content-Type خودکار" },
] as const;

interface MacroHttpActionFieldsProps {
  index: number;
  request?: MacroHttpRequestConfig;
  onChange: (next: MacroHttpRequestConfig) => void;
}

export function MacroHttpActionFields({
  index,
  request,
  onChange,
}: MacroHttpActionFieldsProps) {
  const baseId = useId();
  const headerIds = useRef(new WeakMap<MacroHttpHeader, string>());
  const getHeaderId = (header: MacroHttpHeader) => {
    if (header.id) return header.id;

    const existingId = headerIds.current.get(header);
    if (existingId) return existingId;

    const id = crypto.randomUUID();
    headerIds.current.set(header, id);
    return id;
  };
  const labelId = `${baseId}-label`;
  const methodId = `${baseId}-method`;
  const urlId = `${baseId}-url`;
  const contentTypeId = `${baseId}-ctype`;
  const bodyId = `${baseId}-body`;
  const timeoutId = `${baseId}-timeout`;

  const current: MacroHttpRequestConfig = request ?? {
    method: "GET",
    url: "",
    contentType: "application/json",
    timeoutMs: DEFAULT_MACRO_HTTP_TIMEOUT_MS,
  };
  const headers = current.headers ?? [];

  const update = (patch: Partial<MacroHttpRequestConfig>) => {
    onChange({
      ...current,
      ...patch,
    });
  };

  const applyWledPreset = () => {
    update({
      label: current.label || "کنترل WLED",
      method: "POST",
      url: current.url.trim() ? current.url : "http://192.168.1.50/json/state",
      contentType: "application/json",
      body: '{\n  "on": true,\n  "bri": 180\n}',
    });
  };

  const addHeader = () => {
    update({
      headers: [...headers, { id: crypto.randomUUID(), key: "", value: "" }],
    });
  };

  const updateHeader = (headerIndex: number, patch: Partial<MacroHttpHeader>) => {
    update({
      headers: headers.map((item, i) =>
        i === headerIndex ? { ...item, id: getHeaderId(item), ...patch } : item,
      ),
    });
  };

  const removeHeader = (headerIndex: number) => {
    update({
      headers: headers.filter((_, i) => i !== headerIndex),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary">پیکربندی درخواست HTTP / HTTPS</span>
        <button
          type="button"
          onClick={applyWledPreset}
          className="cursor-pointer rounded-md border border-accent3/40 bg-accent3/10 px-2 py-1 text-[10px] font-semibold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground"
        >
          قالب آماده WLED JSON
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={labelId} className="text-[11px] font-medium text-text-secondary">
          عنوان نمایشی عملیات (اختیاری)
        </Label>
        <Input
          id={labelId}
          value={current.label ?? ""}
          maxLength={60}
          placeholder="مثال: تغییر افکت نوار WLED پذیرایی"
          onChange={(e) => update({ label: e.target.value })}
          className="bg-card-bg-solid text-xs"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={methodId} className="text-[11px] font-medium text-text-secondary">
            نوع درخواست
          </Label>
          <Select
            id={methodId}
            dir="ltr"
            aria-label={`متد HTTP عملیات ${index + 1}`}
            value={current.method}
            onChange={(e) => update({ method: e.target.value as MacroHttpMethod })}
            className="bg-card-bg-solid font-mono text-xs font-semibold"
          >
            {VALID_MACRO_HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={urlId} className="text-[11px] font-medium text-text-secondary">
            آدرس مقصد (URL)
          </Label>
          <Input
            id={urlId}
            type="url"
            dir="ltr"
            value={current.url}
            placeholder="http://192.168.1.50/json/state"
            onChange={(e) => update({ url: e.target.value })}
            className="bg-card-bg-solid font-mono text-xs"
          />
        </div>
      </div>

      {current.method !== "GET" && (
        <div className="space-y-2 border-t border-border-color/60 pt-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={contentTypeId} className="text-[11px] font-medium text-text-secondary">
                Content-Type
              </Label>
              <Select
                id={contentTypeId}
                dir="ltr"
                value={current.contentType ?? "application/json"}
                onChange={(e) => update({ contentType: e.target.value })}
                className="bg-card-bg-solid font-mono text-[11px]"
              >
                {CONTENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "none"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor={timeoutId} className="text-[11px] font-medium text-text-secondary">
                مهلت پاسخ (ms)
              </Label>
              <Input
                id={timeoutId}
                type="number"
                dir="ltr"
                min={500}
                max={30000}
                step={500}
                value={current.timeoutMs ?? DEFAULT_MACRO_HTTP_TIMEOUT_MS}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  update({
                    timeoutMs: Number.isFinite(parsed) ? parsed : DEFAULT_MACRO_HTTP_TIMEOUT_MS,
                  });
                }}
                className="bg-card-bg-solid font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={bodyId} className="text-[11px] font-medium text-text-secondary">
              محتوای درخواست (Payload / Body)
            </Label>
            <textarea
              id={bodyId}
              dir="ltr"
              rows={4}
              value={current.body ?? ""}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={'{"on": true, "bri": 180}'}
              className="w-full rounded-xl border border-border-color bg-card-bg-solid p-2.5 font-mono text-[11px] text-text-primary outline-none transition-colors focus:border-accent3"
            />
          </div>
        </div>
      )}

      {current.method === "GET" && (
        <div className="flex items-center justify-between gap-2 border-t border-border-color/60 pt-2">
          <Label htmlFor={timeoutId} className="text-[11px] font-medium text-text-secondary">
            مهلت پاسخ (میلی‌ثانیه)
          </Label>
          <Input
            id={timeoutId}
            type="number"
            dir="ltr"
            min={500}
            max={30000}
            step={500}
            value={current.timeoutMs ?? DEFAULT_MACRO_HTTP_TIMEOUT_MS}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              update({
                timeoutMs: Number.isFinite(parsed) ? parsed : DEFAULT_MACRO_HTTP_TIMEOUT_MS,
              });
            }}
            className="h-8 w-28 bg-card-bg-solid font-mono text-xs tabular-nums"
          />
        </div>
      )}

      <div className="space-y-2 border-t border-border-color/60 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-text-secondary">
            هدرهای سفارشی ({headers.length})
          </span>
          <button
            type="button"
            onClick={addHeader}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-color bg-card-bg-solid px-2 py-1 text-[10px] font-medium text-text-primary hover:border-accent3"
          >
            <Plus className="size-3" strokeWidth={2} aria-hidden="true" />
            <span>افزودن هدر</span>
          </button>
        </div>

        {headers.map((header, hIdx) => (
          <div key={getHeaderId(header)} className="flex items-center gap-1.5" dir="ltr">
            <Input
              value={header.key}
              placeholder="Header Key (e.g. Authorization)"
              onChange={(e) => updateHeader(hIdx, { key: e.target.value })}
              className="h-8 flex-1 bg-card-bg-solid font-mono text-[11px]"
            />
            <Input
              value={header.value}
              placeholder="Value"
              onChange={(e) => updateHeader(hIdx, { value: e.target.value })}
              className="h-8 flex-1 bg-card-bg-solid font-mono text-[11px]"
            />
            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => removeHeader(hIdx)}
              label={`حذف هدر ${hIdx + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

