import { useEffect, useState, useSyncExternalStore } from "react";
import { soundManager } from "@/lib/audio";
import { debugLog } from "@/lib/debug";
import { AudioSourceSelector } from "./AudioSourceSelector";
import { AudioToggleButton } from "./AudioToggleButton";
import { AudioTrackInfo } from "./AudioTrackInfo";

const subscribeAudioSnapshot = () => () => {};
const getInitialIsMusicOn = () => soundManager.isAmbientPlaying;
const getServerIsMusicOn = () => false;

const getInitialMusicSource = (): "local" | "api" =>
  localStorage.getItem("music_source") === "api" ? "api" : "local";

const getServerMusicSource = (): "local" | "api" => "local";
const getInitialTrackInfo = () => soundManager.currentTrack;
const getServerTrackInfo = () => null;

async function runAudioTask(
  setIsLoading: (val: boolean) => void,
  setPlaybackError: (err: string | null) => void,
  logContext: string,
  userErrorMessage: string,
  task: () => Promise<void>,
  onErrorCallback?: () => void,
): Promise<void> {
  setIsLoading(true);
  setPlaybackError(null);

  try {
    await task();
  } catch (error) {
    debugLog.error("AudioUI", logContext, error);
    setPlaybackError(userErrorMessage);
    onErrorCallback?.();
  } finally {
    setIsLoading(false);
  }
}

export default function AudioSection() {
  const initialMusicOn = useSyncExternalStore(
    subscribeAudioSnapshot,
    getInitialIsMusicOn,
    getServerIsMusicOn,
  );

  const initialMusicSource = useSyncExternalStore(
    subscribeAudioSnapshot,
    getInitialMusicSource,
    getServerMusicSource,
  );

  const initialTrackInfo = useSyncExternalStore(
    subscribeAudioSnapshot,
    getInitialTrackInfo,
    getServerTrackInfo,
  );

  const [musicOnOverride, setMusicOnOverride] = useState<boolean | null>(null);
  const [musicSourceOverride, setMusicSourceOverride] = useState<"local" | "api" | null>(null);
  const [trackInfoOverride, setTrackInfoOverride] = useState<any>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const isMusicOn = musicOnOverride ?? initialMusicOn;
  const musicSource = musicSourceOverride ?? initialMusicSource;
  const trackInfo = trackInfoOverride === undefined ? initialTrackInfo : trackInfoOverride;

  useEffect(() => {
    const handleMusicStart = () => {
      setMusicOnOverride(soundManager.isAmbientPlaying);
      setPlaybackError(null);
    };

    const handleMusicError = (event: Event) => {
      // SAFETY: ambientMusicError event is dispatched as CustomEvent<{ message?: string }>
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMusicOnOverride(false);
      setIsLoading(false);
      setPlaybackError(detail?.message || "پخش آهنگ ناموفق بود.");
    };

    window.addEventListener("ambientMusicStarted", handleMusicStart);
    window.addEventListener("ambientMusicError", handleMusicError);
    soundManager.setOnTrackUpdate((track) => {
      setTrackInfoOverride(track);
      setIsLoading(false);
    });

    return () => {
      window.removeEventListener("ambientMusicStarted", handleMusicStart);
      window.removeEventListener("ambientMusicError", handleMusicError);
      soundManager.setOnTrackUpdate(() => {});
    };
  }, []);

  const handleToggle = async () => {
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Playback button action failed.",
      "پخش آهنگ ناموفق بود. کنسول مرورگر را برای جزئیات بررسی کن.",
      async () => {
        const newState = await soundManager.toggleAmbient();
        setMusicOnOverride(newState);

        if (newState) soundManager.playToggleOn();
        else soundManager.playToggleOff();
      },
      () => setMusicOnOverride(false),
    );
  };

  const handleSourceChange = async (source: "local" | "api") => {
    if (source === musicSource) return;

    setMusicSourceOverride(source);
    localStorage.setItem("music_source", source);
    soundManager.playClick();
    setPlaybackError(null);

    if (isMusicOn) {
      await runAudioTask(
        setIsLoading,
        setPlaybackError,
        "Changing audio source failed.",
        "بارگذاری منبع آهنگ ناموفق بود.",
        async () => {
          soundManager.stopAmbient();
          await soundManager.loadAmbientTrack();
          await soundManager.startAmbient();
        },
      );
    }
  };

  const handleNext = async () => {
    soundManager.playClick();
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Could not play next track.",
      "آهنگ بعدی در دسترس نیست.",
      () => soundManager.nextTrack(),
    );
  };

  const handlePrev = async () => {
    soundManager.playClick();
    await runAudioTask(
      setIsLoading,
      setPlaybackError,
      "Could not play previous track.",
      "آهنگ قبلی در دسترس نیست.",
      () => soundManager.prevTrack(),
    );
  };

  return (
    <div className="space-y-6">
      <AudioToggleButton isMusicOn={isMusicOn} isLoading={isLoading} onToggle={handleToggle} />
      {playbackError && (
        <p role="alert" className="text-xs text-red-400 text-right" aria-live="polite">
          {playbackError}
        </p>
      )}
      <AudioSourceSelector musicSource={musicSource} onSourceChange={handleSourceChange} />
      {isMusicOn && trackInfo && (
        <AudioTrackInfo
          trackInfo={trackInfo}
          isLoading={isLoading}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      )}
    </div>
  );
}
