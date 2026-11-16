const DISPLAY_CLASSES = new Set([
  "block",
  "inline-block",
  "inline",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
  "hidden",
]);

const FONT_WEIGHT_CLASSES = new Set([
  "font-thin",
  "font-extralight",
  "font-light",
  "font-normal",
  "font-medium",
  "font-semibold",
  "font-bold",
  "font-extrabold",
  "font-black",
]);

const FONT_FAMILY_CLASSES = new Set(["font-sans", "font-serif", "font-mono"]);

const TEXT_SIZE_CLASSES = new Set([
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
]);

const TEXT_ALIGN_CLASSES = new Set([
  "text-left",
  "text-center",
  "text-right",
  "text-justify",
  "text-start",
  "text-end",
]);

const ARBITRARY_TEXT_SIZE_REGEX = /^text-\[\d+(\.\d+)?(px|rem|em)\]/;
const ROUNDED_TOKEN_REGEX = /^rounded-(none|xs|sm|md|lg|xl|2xl|3xl|full|\[.+\])$/;
const BORDER_WIDTH_REGEX = /^border-[0248]$/;
const FLEX_DIR_REGEX = /^flex-(row|row-reverse|col|col-reverse)$/;

const PADDING_ALL_KEYS = ["p", "px", "py", "pt", "pb", "pl", "pr", "ps", "pe"] as const;
const PADDING_X_KEYS = ["px", "pl", "pr", "ps", "pe"] as const;
const PADDING_Y_KEYS = ["py", "pt", "pb"] as const;

function getConflictGroup(core: string): string | null {
  if (DISPLAY_CLASSES.has(core)) return "display";

  if (FONT_WEIGHT_CLASSES.has(core)) return "font-weight";

  if (FONT_FAMILY_CLASSES.has(core)) return "font-family";

  if (
    TEXT_SIZE_CLASSES.has(core) ||
    (core.startsWith("text-[") && ARBITRARY_TEXT_SIZE_REGEX.test(core))
  ) {
    return "font-size";
  }

  if (TEXT_ALIGN_CLASSES.has(core)) return "text-align";

  if (
    core.startsWith("text-") &&
    !core.startsWith("text-wrap") &&
    !core.startsWith("text-balance") &&
    !core.startsWith("text-pretty") &&
    !core.startsWith("text-ellipsis") &&
    !core.startsWith("text-clip")
  ) {
    return "text-color";
  }

  if (core.startsWith("bg-")) return "bg-color";

  if (core.startsWith("w-")) return "w";

  if (core.startsWith("min-w-")) return "min-w";

  if (core.startsWith("max-w-")) return "max-w";

  if (core.startsWith("h-")) return "h";

  if (core.startsWith("min-h-")) return "min-h";

  if (core.startsWith("max-h-")) return "max-h";

  if (core.startsWith("size-")) return "size";

  if (core === "rounded" || (core.startsWith("rounded-") && ROUNDED_TOKEN_REGEX.test(core))) {
    return "rounded";
  }

  if (core === "border" || (core.startsWith("border-") && BORDER_WIDTH_REGEX.test(core))) {
    return "border-w";
  }

  if (core.startsWith("leading-")) return "leading";

  if (core.startsWith("justify-")) return "justify";

  if (core.startsWith("items-")) return "items";

  if (core.startsWith("gap-")) return "gap";

  if (core.startsWith("flex-") && FLEX_DIR_REGEX.test(core)) return "flex-dir";

  return null;
}

export function cn(...inputs: Array<string | false | null | undefined>): string {
  const inputsLen = inputs.length;

  if (inputsLen === 0) return "";

  const result: string[] = [];
  const groupIndexMap = new Map<string, number>();

  for (let a = 0; a < inputsLen; a++) {
    const input = inputs[a];

    if (!input) continue;

    const len = input.length;
    let i = 0;

    while (i < len) {
      while (i < len && input.charCodeAt(i) <= 32) {
        i++;
      }

      if (i >= len) break;

      const tokenStart = i;

      while (i < len && input.charCodeAt(i) > 32) {
        i++;
      }

      const token = input.slice(tokenStart, i);
      const lastColon = token.lastIndexOf(":");
      const variantPrefix = lastColon >= 0 ? token.slice(0, lastColon + 1) : "";
      const core = lastColon >= 0 ? token.slice(lastColon + 1) : token;

      if (core.startsWith("p-") && core.length > 2) {
        for (let k = 0; k < PADDING_ALL_KEYS.length; k++) {
          const prevIdx = groupIndexMap.get(`${variantPrefix}${PADDING_ALL_KEYS[k]}`);

          if (prevIdx !== undefined) result[prevIdx] = "";
        }

        groupIndexMap.set(`${variantPrefix}p`, result.length);
        result.push(token);
        continue;
      }

      if (core.startsWith("px-") && core.length > 3) {
        for (let k = 0; k < PADDING_X_KEYS.length; k++) {
          const prevIdx = groupIndexMap.get(`${variantPrefix}${PADDING_X_KEYS[k]}`);

          if (prevIdx !== undefined) result[prevIdx] = "";
        }

        groupIndexMap.set(`${variantPrefix}px`, result.length);
        result.push(token);
        continue;
      }

      if (core.startsWith("py-") && core.length > 3) {
        for (let k = 0; k < PADDING_Y_KEYS.length; k++) {
          const prevIdx = groupIndexMap.get(`${variantPrefix}${PADDING_Y_KEYS[k]}`);

          if (prevIdx !== undefined) result[prevIdx] = "";
        }

        groupIndexMap.set(`${variantPrefix}py`, result.length);
        result.push(token);
        continue;
      }

      const group = getConflictGroup(core);

      if (group) {
        const key = `${variantPrefix}${group}`;
        const prevIdx = groupIndexMap.get(key);

        if (prevIdx !== undefined) {
          result[prevIdx] = "";
        }

        groupIndexMap.set(key, result.length);
      }

      result.push(token);
    }
  }

  let out = "";

  for (let i = 0; i < result.length; i++) {
    const item = result[i];

    if (item) {
      out = out ? `${out} ${item}` : item;
    }
  }

  return out;
}

/** Shared accessible keyboard focus ring classes backed by semantic design tokens. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset";

/** Shared disabled interaction utility classes. */
export const disabled = "disabled:pointer-events-none disabled:opacity-50";
