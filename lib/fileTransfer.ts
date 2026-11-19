/**
 * Native browser file I/O and sharing utilities powered by the
 * File System Access API (`showSaveFilePicker` / `showOpenFilePicker`) and
 * Web Share API (`navigator.canShare` / `navigator.share`), with automatic
 * graceful fallbacks for browsers or iframe environments without native picker support.
 */

interface FilePickerAcceptType {
  description: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface FileSystemWritableFileStreamLike {
  write: (data: string | Blob) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
}

type WindowWithFileSystemAccess = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>;
};

const JSON_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: "JSON Configuration File",
    accept: {
      "application/json": [".json"],
    },
  },
];

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isFileSystemAccessSupported(): boolean {
  if (globalThis.window === undefined) return false;

  const win = globalThis.window as WindowWithFileSystemAccess;

  return (
    typeof win.showSaveFilePicker === "function" && typeof win.showOpenFilePicker === "function"
  );
}

export function isWebShareSupported(): boolean {
  if (globalThis.navigator === undefined) return false;

  return typeof globalThis.navigator.share === "function";
}

/**
 * Serializes `data` as formatted JSON and saves it to disk using `showSaveFilePicker`
 * when available, falling back to a synthetic `<a download>` anchor when unsupported
 * or blocked by cross-origin iframe security policies.
 */
export async function saveJsonWithFilePicker(options: {
  filename: string;
  description?: string;
  data: unknown;
}): Promise<{ saved: boolean; method: "fs-access" | "download" | "cancelled" }> {
  if (globalThis.window === undefined) {
    return { saved: false, method: "cancelled" };
  }

  const serialized = JSON.stringify(options.data, null, 2);
  const win = globalThis.window as WindowWithFileSystemAccess;

  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: options.filename,
        types: options.description
          ? [{ description: options.description, accept: { "application/json": [".json"] } }]
          : JSON_PICKER_TYPES,
      });

      const writable = await handle.createWritable();
      await writable.write(serialized);
      await writable.close();

      return { saved: true, method: "fs-access" };
    } catch (error) {
      if (isAbortError(error)) {
        return { saved: false, method: "cancelled" };
      }
      // SecurityError inside cross-origin iframe or unsupported context falls through to download
    }
  }

  const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = options.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

  return { saved: true, method: "download" };
}

/**
 * Opens and parses a JSON file from disk using `showOpenFilePicker` when available,
 * falling back to a temporary `<input type="file" accept=".json,application/json">`.
 */
export async function openJsonWithFilePicker<T = unknown>(options?: {
  description?: string;
}): Promise<{ data: T; filename: string; method: "fs-access" | "input" } | null> {
  if (globalThis.window === undefined) return null;

  const win = globalThis.window as WindowWithFileSystemAccess;

  if (typeof win.showOpenFilePicker === "function") {
    try {
      const handles = await win.showOpenFilePicker({
        multiple: false,
        types: options?.description
          ? [{ description: options.description, accept: { "application/json": [".json"] } }]
          : JSON_PICKER_TYPES,
      });

      const handle = handles[0];

      if (!handle) return null;

      const file = await handle.getFile();
      const text = await file.text();

      return {
        data: JSON.parse(text) as T,
        filename: file.name,
        method: "fs-access",
      };
    } catch (error) {
      if (isAbortError(error)) {
        return null;
      }
      // Fall through to input element if blocked by iframe policy
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";

    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        resolve(null);

        return;
      }

      try {
        const text = await file.text();
        resolve({
          data: JSON.parse(text) as T,
          filename: file.name,
          method: "input",
        });
      } catch (err) {
        reject(err);
      }
    };

    input.oncancel = () => {
      if (input.parentNode) document.body.removeChild(input);
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Shares a JSON payload via the native OS share sheet (`navigator.share` with a `File`
 * attachment when `navigator.canShare` allows, or text payload), falling back to
 * copying the formatted JSON to the clipboard when Web Share is unavailable.
 */
export async function shareJsonPayload(options: {
  title: string;
  text: string;
  filename: string;
  data: unknown;
}): Promise<{
  shared: boolean;
  method: "web-share-file" | "web-share-text" | "clipboard" | "cancelled";
}> {
  if (globalThis.navigator === undefined) {
    return { shared: false, method: "cancelled" };
  }

  const serialized = JSON.stringify(options.data, null, 2);

  if (typeof globalThis.navigator.share === "function") {
    try {
      const file = new File([serialized], options.filename, {
        type: "application/json",
      });

      if (
        typeof globalThis.navigator.canShare === "function" &&
        globalThis.navigator.canShare({ files: [file] })
      ) {
        await globalThis.navigator.share({
          title: options.title,
          text: options.text,
          files: [file],
        });

        return { shared: true, method: "web-share-file" };
      }

      await globalThis.navigator.share({
        title: options.title,
        text: `${options.text}\n\n${serialized}`,
      });

      return { shared: true, method: "web-share-text" };
    } catch (error) {
      if (isAbortError(error)) {
        return { shared: false, method: "cancelled" };
      }
      // Fall through to clipboard fallback when Web Share is blocked in iframe or desktop context
    }
  }

  if (globalThis.navigator.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(serialized);

    return { shared: true, method: "clipboard" };
  }

  return { shared: false, method: "cancelled" };
}
