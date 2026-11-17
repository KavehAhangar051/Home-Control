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
  "text-fluid-xs",
  "text-fluid-sm",
  "text-fluid-base",
  "text-fluid-lg",
  "text-fluid-xl",
  "text-fluid-2xl",
  "text-fluid-3xl",
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

const BORDER_STYLE_CLASSES = new Set([
  "border-solid",
  "border-dashed",
  "border-dotted",
  "border-double",
  "border-hidden",
  "border-none",
]);

const BORDER_COLLAPSE_CLASSES = new Set(["border-collapse", "border-separate"]);
const BORDER_SIDE_PREFIX_REGEX = /^border-[trblxyse](-|$)/;
const RING_WIDTH_REGEX = /^ring(-[01248]|-inset|-\[\d+px\])?$/;
const SIZE_CONFLICT_KEYS = ["size", "w", "h"] as const;

const SIMPLE_PREFIX_GROUPS: ReadonlyArray<readonly [prefix: string, group: string]> = [
  ["bg-", "bg-color"],
  ["min-w-", "min-w"],
  ["max-w-", "max-w"],
  ["w-", "w"],
  ["min-h-", "min-h"],
  ["max-h-", "max-h"],
  ["h-", "h"],
  ["size-", "size"],
  ["leading-", "leading"],
  ["justify-", "justify"],
  ["items-", "items"],
  ["gap-", "gap"],
  ["ps-", "ps"],
  ["pe-", "pe"],
  ["pl-", "pl"],
  ["pr-", "pr"],
  ["pt-", "pt"],
  ["pb-", "pb"],
];

const TEXT_NON_COLOR_PREFIXES = [
  "text-wrap",
  "text-balance",
  "text-pretty",
  "text-ellipsis",
  "text-clip",
] as const;

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
    !TEXT_NON_COLOR_PREFIXES.some((prefix) => core.startsWith(prefix))
  ) {
    return "text-color";
  }

  for (let i = 0; i < SIMPLE_PREFIX_GROUPS.length; i++) {
    const [prefix, group] = SIMPLE_PREFIX_GROUPS[i];

    if (core.startsWith(prefix)) return group;
  }

  if (core === "rounded" || (core.startsWith("rounded-") && ROUNDED_TOKEN_REGEX.test(core))) {
    return "rounded";
  }

  if (core === "border" || (core.startsWith("border-") && BORDER_WIDTH_REGEX.test(core))) {
    return "border-w";
  }

  if (BORDER_STYLE_CLASSES.has(core)) return "border-style";

  if (BORDER_COLLAPSE_CLASSES.has(core)) return "border-collapse";

  if (
    core.startsWith("border-") &&
    !core.startsWith("border-spacing-") &&
    !BORDER_SIDE_PREFIX_REGEX.test(core)
  ) {
    return "border-color";
  }

  if (core === "ring" || (core.startsWith("ring-") && RING_WIDTH_REGEX.test(core))) {
    return "ring-w";
  }

  if (core.startsWith("ring-") && !core.startsWith("ring-offset-")) {
    return "ring-color";
  }

  if (core.startsWith("flex-") && FLEX_DIR_REGEX.test(core)) return "flex-dir";

  return null;
}

function clearConflictingGroups(
  result: string[],
  groupIndexMap: Map<string, number>,
  variantPrefix: string,
  keys: ReadonlyArray<string>,
  deleteFromMap = false,
): void {
  for (let k = 0; k < keys.length; k++) {
    const mapKey = `${variantPrefix}${keys[k]}`;
    const prevIdx = groupIndexMap.get(mapKey);

    if (prevIdx !== undefined) {
      result[prevIdx] = "";

      if (deleteFromMap) {
        groupIndexMap.delete(mapKey);
      }
    }
  }
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
        clearConflictingGroups(result, groupIndexMap, variantPrefix, PADDING_ALL_KEYS);
        groupIndexMap.set(`${variantPrefix}p`, result.length);
        result.push(token);
        continue;
      }

      if (core.startsWith("px-") && core.length > 3) {
        clearConflictingGroups(result, groupIndexMap, variantPrefix, PADDING_X_KEYS);
        groupIndexMap.set(`${variantPrefix}px`, result.length);
        result.push(token);
        continue;
      }

      if (core.startsWith("py-") && core.length > 3) {
        clearConflictingGroups(result, groupIndexMap, variantPrefix, PADDING_Y_KEYS);
        groupIndexMap.set(`${variantPrefix}py`, result.length);
        result.push(token);
        continue;
      }

      if (core.startsWith("size-") && core.length > 5) {
        clearConflictingGroups(result, groupIndexMap, variantPrefix, SIZE_CONFLICT_KEYS, true);
        groupIndexMap.set(`${variantPrefix}size`, result.length);
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

        if (
          (group === "w" || group === "h") &&
          groupIndexMap.has(`${variantPrefix}w`) &&
          groupIndexMap.has(`${variantPrefix}h`)
        ) {
          const prevSizeIdx = groupIndexMap.get(`${variantPrefix}size`);

          if (prevSizeIdx !== undefined) {
            result[prevSizeIdx] = "";
            groupIndexMap.delete(`${variantPrefix}size`);
          }
        }
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

/**
 * Computes a CSS `clamp()` fluid value that scales linearly between `minSize` (rem)
 * at `minWidth` (px) and `maxSize` (rem) at `maxWidth` (px).
 */
export function fluidValue(
  minSize: number,
  maxSize: number,
  minWidth = 320,
  maxWidth = 1280,
): string {
  if (maxWidth <= minWidth || minSize === maxSize) {
    return `${minSize}rem`;
  }

  const minWidthRem = minWidth / 16;
  const maxWidthRem = maxWidth / 16;
  const slope = (maxSize - minSize) / (maxWidthRem - minWidthRem);
  const yAxisIntersection = -minWidthRem * slope + minSize;

  return `clamp(${minSize}rem, ${Number(yAxisIntersection.toFixed(4))}rem + ${Number((slope * 100).toFixed(4))}vw, ${maxSize}rem)`;
}

/** Standardized fluid typography scale generated via `fluidValue`. */
export const fluidTypeScale = {
  xs: fluidValue(0.75, 0.8125),
  sm: fluidValue(0.8125, 0.9375),
  base: fluidValue(0.9375, 1.0625),
  lg: fluidValue(1.0625, 1.25),
  xl: fluidValue(1.25, 1.625),
  "2xl": fluidValue(1.5, 2.25),
  "3xl": fluidValue(1.875, 2.75),
} as const;
