import { scheduleIdleStorageWrite } from "@/lib/asyncScheduler";
import { debugLog } from "@/lib/debug";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { createTimeoutSignal } from "@/lib/resilience";
import { audioContextManager } from "./context";
import { fetchArchivePlaylist, fetchTrackUrl } from "./playlist";
import type { ArchiveTrackItem, Track } from "./types";

const AUDIO_CACHE_NAME = "home-control-audio-v1";
const AUDIO_DOWNLOAD_TIMEOUT_MS = 15_000;

const ONLINE_SOURCE = "api";
const MAX_ONLINE_RESOLVE_ATTEMPTS = 5;

export interface AmbientAudioLike {
  preload: string;
  loop: boolean;
  volume: number;
  src: string;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
}

export interface AmbientMusicErrorDetail {
  message: string;
  cause: unknown;
}

export interface AmbientManagerDeps {
  isBrowserEnvironment?: () => boolean;
  randomFn?: () => number;
  readCachedTrack?: (expectedSource: string) => Track | null;
  writeCachedTrack?: (source: string, track: Track) => void;
  fetchPlaylistFn?: () => Promise<ArchiveTrackItem[]>;
  fetchTrackUrlFn?: (identifier: string) => Promise<string | null>;
  createAudioFn?: () => AmbientAudioLike;
  dispatchEventFn?: (
    eventName: "ambientMusicStarted" | "ambientMusicError",
    detail?: AmbientMusicErrorDetail,
  ) => void;
  getAudioContextFn?: () => AudioContext | null | undefined;
  fetchFn?: typeof fetch;
  resolvePlayableUrlFn?: (url: string) => Promise<string>;
}

function tryRestoreCachedTrack(expectedSource: string): Track | null {
  try {
    const saved = localStorage.getItem("music_cached_track");

    if (!saved) return null;

    // SAFETY: music_cached_track JSON payload matches saved track shape { source?: string; track?: Track }
    const selection = JSON.parse(saved) as { source?: string; track?: Track };

    if (selection.source === expectedSource && selection.track?.url && !selection.track.isLocal) {
      return selection.track;
    }
  } catch (error) {
    debugLog.warn("Audio", "Could not restore the saved music selection.", error);
  }

  return null;
}

function persistSelectedTrack(source: string, track: Track): void {
  scheduleIdleStorageWrite("music_cached_track", () => JSON.stringify({ source, track }), {
    onError: (error) => {
      debugLog.warn("Audio", "Could not persist the current music selection.", error);
    },
  });
}

export class AmbientManager {
  public ambientAudio: AmbientAudioLike | null = null;
  public isAmbientPlaying = false;
  public currentTrack: Track | null = null;
  private onTrackUpdateCallback: ((track: Track) => void) | null = null;
  public playlist: ArchiveTrackItem[] = [];
  public currentTrackIndex = -1;
  private activeObjectUrl: string | null = null;
  private readonly deps: Required<Omit<AmbientManagerDeps, "resolvePlayableUrlFn">> & {
    resolvePlayableUrlFn?: (url: string) => Promise<string>;
  };

  constructor(deps: AmbientManagerDeps = {}) {
    this.deps = {
      isBrowserEnvironment: deps.isBrowserEnvironment ?? (() => typeof window !== "undefined"),
      randomFn: deps.randomFn ?? (() => Math.random()),
      readCachedTrack: deps.readCachedTrack ?? tryRestoreCachedTrack,
      writeCachedTrack: deps.writeCachedTrack ?? persistSelectedTrack,
      fetchPlaylistFn: deps.fetchPlaylistFn ?? fetchArchivePlaylist,
      fetchTrackUrlFn: deps.fetchTrackUrlFn ?? fetchTrackUrl,
      createAudioFn: deps.createAudioFn ?? (() => new Audio()),
      dispatchEventFn:
        deps.dispatchEventFn ??
        ((eventName, detail) => {
          if (typeof window === "undefined") return;

          if (detail === undefined) {
            window.dispatchEvent(new Event(eventName));
          } else {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
          }
        }),
      getAudioContextFn: deps.getAudioContextFn ?? (() => audioContextManager.getContext()),
      fetchFn: deps.fetchFn ?? fetch,
      resolvePlayableUrlFn: deps.resolvePlayableUrlFn,
    };
  }

  public setOnTrackUpdate(cb: (track: Track) => void) {
    this.onTrackUpdateCallback = cb;

    if (this.currentTrack) cb(this.currentTrack);
  }

  public async fetchPlaylistIfNeeded() {
    if (this.playlist.length > 0) return true;

    const docs = await this.deps.fetchPlaylistFn();

    if (docs.length === 0) {
      debugLog.warn("Audio", "Online playlist request returned no tracks.");

      return false;
    }

    this.playlist = docs;
    this.currentTrackIndex = Math.floor(this.deps.randomFn() * this.playlist.length);

    return true;
  }

  private advancePlaylistIndex(direction?: "next" | "prev"): void {
    if (this.playlist.length === 0) return;

    if (direction === "next") {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    } else if (direction === "prev") {
      this.currentTrackIndex =
        (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
    }
  }

  private async resolveOnlineTrackFromPlaylist(): Promise<Track | null> {
    const maxAttempts = Math.min(MAX_ONLINE_RESOLVE_ATTEMPTS, this.playlist.length);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const track = this.playlist[this.currentTrackIndex];
        const url = await this.deps.fetchTrackUrlFn(track.identifier);

        if (url) {
          return {
            title: track.title || "Unknown track",
            creator: track.creator || "Unknown artist",
            url,
            isLocal: false,
          };
        }
      } catch (error) {
        debugLog.warn("Audio", "Could not resolve an online track.", {
          attempt: attempt + 1,
          error,
        });
      }

      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
    }

    return null;
  }

  public async loadAmbientTrack(direction?: "next" | "prev") {
    if (!this.deps.isBrowserEnvironment()) return;

    if (!direction) {
      const restored = this.deps.readCachedTrack(ONLINE_SOURCE);

      if (restored) {
        this.currentTrack = restored;

        if (this.isAmbientPlaying) await this.playCurrentTrack();
        this.onTrackUpdateCallback?.(this.currentTrack);

        return;
      }
    }

    const hasPlaylist = await this.fetchPlaylistIfNeeded();

    if (!hasPlaylist) {
      this.currentTrack = null;
      this.isAmbientPlaying = false;
      this.deps.dispatchEventFn("ambientMusicError", {
        message: "آرشیو آنلاین موسیقی در دسترس نیست. اتصال اینترنت را بررسی کن.",
        cause: "playlist_unavailable",
      });

      return;
    }

    this.advancePlaylistIndex(direction);
    const resolvedTrack = await this.resolveOnlineTrackFromPlaylist();

    if (!resolvedTrack) {
      this.currentTrack = null;
      this.isAmbientPlaying = false;
      debugLog.warn("Audio", "Online tracks unavailable after resolution attempts.");
      this.deps.dispatchEventFn("ambientMusicError", {
        message: "هیچ ترک آنلاینی برای پخش یافت نشد. اتصال اینترنت را بررسی کن.",
        cause: "track_resolution_failed",
      });

      return;
    }

    this.currentTrack = resolvedTrack;
    this.deps.writeCachedTrack(ONLINE_SOURCE, this.currentTrack);

    if (this.isAmbientPlaying) await this.playCurrentTrack();

    this.onTrackUpdateCallback?.(this.currentTrack);
  }

  private async getPlayableUrl(url: string): Promise<string> {
    if (this.deps.resolvePlayableUrlFn) {
      return this.deps.resolvePlayableUrlFn(url);
    }

    if (typeof window === "undefined") return url;

    const requestUrl = new URL(url, window.location.href).toString();

    if (!FEATURE_FLAGS.audioLocalCache || !("caches" in window)) return requestUrl;

    try {
      const cache = await window.caches.open(AUDIO_CACHE_NAME);
      let response = await cache.match(requestUrl);

      if (response) {
        debugLog.info("Audio", "Using locally cached audio.", { url: requestUrl });
      } else {
        debugLog.info("Audio", "Downloading audio after explicit user playback request.", {
          url: requestUrl,
        });
        const timeout = createTimeoutSignal(AUDIO_DOWNLOAD_TIMEOUT_MS);

        try {
          response = await this.deps.fetchFn(requestUrl, { signal: timeout.signal });
        } finally {
          timeout.cleanup();
        }

        if (!response.ok) {
          throw new Error(`Audio request failed: ${response.status} ${response.statusText}`);
        }

        try {
          await cache.put(requestUrl, response.clone());
          debugLog.info("Audio", "Audio cached locally for subsequent playback.", {
            url: requestUrl,
          });
        } catch (error) {
          debugLog.warn("Audio", "Audio playback can continue, but local caching failed.", error);
        }
      }

      if (!response.ok) {
        throw new Error(`Audio request failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      if (this.activeObjectUrl) URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = URL.createObjectURL(blob);

      return this.activeObjectUrl;
    } catch (error) {
      debugLog.error(
        "Audio",
        "Local audio cache failed; falling back to direct playback URL.",
        error,
      );

      return requestUrl;
    }
  }

  private async playCurrentTrack() {
    if (!this.currentTrack || !this.deps.isBrowserEnvironment()) return;

    if (!this.ambientAudio) {
      this.ambientAudio = this.deps.createAudioFn();
      this.ambientAudio.preload = "none";
      this.ambientAudio.loop = true;
      this.ambientAudio.volume = 0.3;
    }

    try {
      const playableUrl = await this.getPlayableUrl(this.currentTrack.url);
      this.ambientAudio.src = playableUrl;
      await this.ambientAudio.play();
      this.isAmbientPlaying = true;
      this.deps.dispatchEventFn("ambientMusicStarted");
    } catch (error) {
      this.isAmbientPlaying = false;
      debugLog.error("Audio", "Audio playback failed.", {
        track: this.currentTrack.title,
        source: this.currentTrack.url,
        error,
      });
      this.deps.dispatchEventFn("ambientMusicError", {
        message: "پخش آهنگ ناموفق بود. اتصال و منبع فایل را بررسی کن.",
        cause: error,
      });
    }

    this.deps.getAudioContextFn();
  }

  public async start(enabled: boolean) {
    if (!enabled || !this.deps.isBrowserEnvironment()) return;

    if (this.isAmbientPlaying) return;

    try {
      if (!this.currentTrack) await this.loadAmbientTrack();
      await this.playCurrentTrack();
    } catch (error) {
      this.isAmbientPlaying = false;
      debugLog.error("Audio", "Could not start ambient playback.", error);
    }
  }

  public stop() {
    if (!this.ambientAudio || !this.isAmbientPlaying) return;
    this.ambientAudio.pause();
    this.ambientAudio.currentTime = 0;
    this.isAmbientPlaying = false;
  }
}
