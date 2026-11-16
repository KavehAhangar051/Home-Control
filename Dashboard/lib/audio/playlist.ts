import { debugLog } from "@/lib/debug";
import { createTimeoutSignal, recordIntegrationRequest } from "@/lib/resilience";

const ARCHIVE_METADATA_TIMEOUT_MS = 8000;

export async function fetchArchivePlaylist(fetchFn: typeof fetch = globalThis.fetch) {
  const timeout = createTimeoutSignal(ARCHIVE_METADATA_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetchFn(
      "https://archive.org/advancedsearch.php?q=subject:(traditional+OR+historical)+AND+subject:(instrumental)+AND+mediatype:(audio)&fl[]=identifier,title,creator&sort[]=downloads+desc&rows=30&output=json",
      { signal: timeout.signal },
    );

    if (!response.ok) {
      throw new Error(`Archive playlist request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const docs = data.response?.docs;
    recordIntegrationRequest("archive", Date.now() - startedAt, true);

    if (Array.isArray(docs) && docs.length > 0) return docs;

    debugLog.warn("AudioPlaylist", "Archive API returned an empty playlist.");
  } catch (error) {
    recordIntegrationRequest("archive", Date.now() - startedAt, false);
    debugLog.error("AudioPlaylist", "Could not fetch Archive playlist.", error);
  } finally {
    timeout.cleanup();
  }

  return [];
}

export async function fetchTrackUrl(
  identifier: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  const timeout = createTimeoutSignal(ARCHIVE_METADATA_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetchFn(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
      { signal: timeout.signal },
    );

    if (!response.ok) {
      throw new Error(`Track metadata request failed: ${response.status} ${response.statusText}`);
    }

    const metadata = await response.json();
    recordIntegrationRequest("archive", Date.now() - startedAt, true);
    const files = Array.isArray(metadata.files) ? metadata.files : [];

    const mp3File = files.find(
      (file: { format?: string; name?: string }) =>
        file.name &&
        (file.format === "128Kbps MP3" ||
          file.format === "VBR MP3" ||
          file.name.endsWith(".mp3") ||
          file.name.endsWith(".MP3")),
    );

    if (!mp3File?.name) {
      debugLog.warn("AudioPlaylist", "No MP3 file found for online track.", { identifier });

      return null;
    }

    const encodedFileName = mp3File.name.includes("/")
      ? mp3File.name.split("/").map(encodeURIComponent).join("/")
      : encodeURIComponent(mp3File.name);

    return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedFileName}`;
  } catch (error) {
    recordIntegrationRequest("archive", Date.now() - startedAt, false);
    debugLog.error("AudioPlaylist", "Could not resolve online track URL.", { identifier, error });

    return null;
  } finally {
    timeout.cleanup();
  }
}
