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

function getConflictGroup(core: string): string | null {
  if (DISPLAY_CLASSES.has(core)) return "display";

  if (FONT_WEIGHT_CLASSES.has(core)) return "font-weight";

  if (FONT_FAMILY_CLASSES.has(core)) return "font-family";

  if (TEXT_SIZE_CLASSES.has(core) || /^text-\[\d+(\.\d+)?(px|rem|em)\]/.test(core)) {
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

  if (core === "rounded" || /^rounded-(none|xs|sm|md|lg|xl|2xl|3xl|full|\[.+\])$/.test(core)) {
    return "rounded";
  }

  if (core === "border" || /^border-[0248]$/.test(core)) return "border-w";

  if (core.startsWith("leading-")) return "leading";

  if (core.startsWith("justify-")) return "justify";

  if (core.startsWith("items-")) return "items";

  if (core.startsWith("gap-")) return "gap";

  if (/^flex-(row|row-reverse|col|col-reverse)$/.test(core)) return "flex-dir";

  return null;
}

export function cn(...inputs: Array<string | false | null | undefined>): string {
  const rawTokens = inputs
    .filter((x): x is string => Boolean(x))
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const result: string[] = [];
  const groupIndexMap = new Map<string, number>();

  for (const token of rawTokens) {
    const lastColon = token.lastIndexOf(":");
    const variantPrefix = lastColon >= 0 ? token.slice(0, lastColon + 1) : "";
    const core = lastColon >= 0 ? token.slice(lastColon + 1) : token;

    if (/^p-\S+$/.test(core)) {
      for (const k of ["p", "px", "py", "pt", "pb", "pl", "pr", "ps", "pe"]) {
        const prevIdx = groupIndexMap.get(`${variantPrefix}${k}`);

        if (prevIdx !== undefined) result[prevIdx] = "";
      }

      groupIndexMap.set(`${variantPrefix}p`, result.length);
      result.push(token);
      continue;
    }

    if (/^px-\S+$/.test(core)) {
      for (const k of ["px", "pl", "pr", "ps", "pe"]) {
        const prevIdx = groupIndexMap.get(`${variantPrefix}${k}`);

        if (prevIdx !== undefined) result[prevIdx] = "";
      }

      groupIndexMap.set(`${variantPrefix}px`, result.length);
      result.push(token);
      continue;
    }

    if (/^py-\S+$/.test(core)) {
      for (const k of ["py", "pt", "pb"]) {
        const prevIdx = groupIndexMap.get(`${variantPrefix}${k}`);

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

  return result.filter(Boolean).join(" ");
}
